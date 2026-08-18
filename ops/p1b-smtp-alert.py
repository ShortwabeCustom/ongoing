#!/usr/bin/env python3
"""P1-B email sender: Microsoft consumer OAuth2 refresh -> SMTP XOAUTH2."""

from __future__ import annotations

import argparse
import base64
import json
import os
import smtplib
import ssl
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from email.message import EmailMessage
from pathlib import Path

TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
DEVICE_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode"
SCOPE = "offline_access https://outlook.office.com/SMTP.Send"
CONFIG_PATH = Path("/etc/pruebas-maria/backup-alert.env")
TEST_MARKER = Path("/var/lib/pruebas-maria-alert/test-email-sent")


def post_form(url: str, data: dict[str, str]) -> dict[str, object]:
    request = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(data).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        payload = json.load(error)
        raise RuntimeError(str(payload.get("error", "oauth_request_failed"))) from None


def load_config() -> dict[str, str]:
    config: dict[str, str] = {}
    for line in CONFIG_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator:
            raise RuntimeError("invalid_secret_file_format")
        config[key] = value
    required = {
        "ALERT_SMTP_USER",
        "ALERT_OAUTH_CLIENT_ID",
        "ALERT_OAUTH_REFRESH_TOKEN",
        "ALERT_RECIPIENT",
    }
    if missing := sorted(key for key in required if not config.get(key)):
        raise RuntimeError("missing_config:" + ",".join(missing))
    return config


def write_config(user: str, client_id: str, refresh_token: str, recipient: str) -> None:
    if os.geteuid() != 0:
        raise RuntimeError("authorization_must_run_as_root")
    CONFIG_PATH.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = CONFIG_PATH.with_suffix(".env.new")
    content = (
        f"ALERT_SMTP_USER={user}\n"
        f"ALERT_OAUTH_CLIENT_ID={client_id}\n"
        f"ALERT_OAUTH_REFRESH_TOKEN={refresh_token}\n"
        "ALERT_SMTP_HOST=smtp-mail.outlook.com\n"
        "ALERT_SMTP_PORT=587\n"
        f"ALERT_RECIPIENT={recipient}\n"
    )
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, CONFIG_PATH)
    os.chmod(CONFIG_PATH, 0o600)


def authorize_device(client_id: str, user: str, recipient: str) -> None:
    if CONFIG_PATH.exists():
        raise RuntimeError("secret_file_already_exists")
    device = post_form(DEVICE_URL, {"client_id": client_id, "scope": SCOPE})
    print(str(device["message"]), flush=True)
    deadline = time.monotonic() + int(device["expires_in"])
    interval = int(device.get("interval", 5))
    while time.monotonic() < deadline:
        time.sleep(interval)
        try:
            token = post_form(
                TOKEN_URL,
                {
                    "client_id": client_id,
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    "device_code": str(device["device_code"]),
                },
            )
        except RuntimeError as error:
            if str(error) == "authorization_pending":
                continue
            if str(error) == "slow_down":
                interval += 5
                continue
            raise
        refresh_token = str(token.get("refresh_token", ""))
        if not refresh_token:
            raise RuntimeError("refresh_token_not_returned")
        write_config(user, client_id, refresh_token, recipient)
        print("OAUTH_CONSENT_COMPLETED=YES")
        print("REFRESH_TOKEN_PROVISIONED=YES")
        return
    raise RuntimeError("device_authorization_expired")


def refresh_access_token(config: dict[str, str]) -> str:
    token = post_form(
        TOKEN_URL,
        {
            "client_id": config["ALERT_OAUTH_CLIENT_ID"],
            "grant_type": "refresh_token",
            "refresh_token": config["ALERT_OAUTH_REFRESH_TOKEN"],
            "scope": SCOPE,
        },
    )
    access_token = str(token.get("access_token", ""))
    if not access_token:
        raise RuntimeError("access_token_not_returned")
    return access_token


def send(subject: str, body: str) -> None:
    config = load_config()
    access_token = refresh_access_token(config)
    message = EmailMessage()
    message["From"] = config["ALERT_SMTP_USER"]
    message["To"] = config["ALERT_RECIPIENT"]
    message["Subject"] = subject
    message.set_content(body)
    auth = base64.b64encode(
        f"user={config['ALERT_SMTP_USER']}\x01auth=Bearer {access_token}\x01\x01".encode()
    ).decode()
    host = config.get("ALERT_SMTP_HOST", "smtp-mail.outlook.com")
    port = int(config.get("ALERT_SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ssl.create_default_context())
        smtp.ehlo()
        code, _ = smtp.docmd("AUTH", "XOAUTH2 " + auth)
        if code != 235:
            raise RuntimeError("smtp_oauth_rejected")
        refused = smtp.send_message(message)
        if refused:
            raise RuntimeError("smtp_recipient_refused")


def send_test() -> None:
    if TEST_MARKER.exists():
        raise RuntimeError("test_email_already_sent")
    send(
        "[Pruebas María][P1-B Backup] TEST",
        "Prueba única de entrega SMTP OAuth2 para alertas P1-B.\n",
    )
    TEST_MARKER.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    TEST_MARKER.write_text("ALERT_DELIVERY_VERIFIED=YES\n")
    os.chmod(TEST_MARKER, 0o600)
    print("ALERT_DELIVERY_VERIFIED=YES")


def send_event(event_path: Path) -> None:
    delivered = event_path.with_suffix(event_path.suffix + ".delivered")
    if delivered.exists():
        return
    fields: dict[str, str] = {}
    for line in event_path.read_text().splitlines():
        key, separator, value = line.partition("=")
        if separator and key in {"TIMESTAMP_UTC", "STATUS", "EVENT", "BACKUP_ID", "REQUIRED_ACTION"}:
            fields[key] = value
    event = fields.get("EVENT", "BACKUP_FAILED")
    body = "\n".join(f"{key}={value}" for key, value in fields.items()) + "\n"
    send(f"[Pruebas María][P1-B Backup] FAIL {event}", body)
    delivered.write_text("DELIVERY=PASS\n")
    os.chmod(delivered, 0o600)


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    auth = sub.add_parser("authorize-device")
    auth.add_argument("--client-id", required=True)
    auth.add_argument("--user", required=True)
    auth.add_argument("--recipient", required=True)
    sub.add_parser("test")
    event = sub.add_parser("send-event")
    event.add_argument("event_file", type=Path)
    arguments = parser.parse_args()
    if arguments.command == "authorize-device":
        authorize_device(arguments.client_id, arguments.user, arguments.recipient)
    elif arguments.command == "test":
        send_test()
    else:
        send_event(arguments.event_file)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ALERT_ERROR={error}", file=sys.stderr)
        raise SystemExit(1)
