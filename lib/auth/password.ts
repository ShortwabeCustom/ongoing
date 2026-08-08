import { hash, verify } from "@node-rs/argon2";

export async function hashPassword(password: string): Promise<string> {
  const hashed = await hash(password, {
    memoryCost: 19456, // 19 MB
    timeCost: 2,
    parallelism: 1,
  });
  return hashed;
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    const valid = await verify(hash, password);
    return valid;
  } catch {
    return false;
  }
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("La contraseña debe tener al menos 8 caracteres");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Debe contener al menos una mayúscula");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Debe contener al menos una minúscula");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Debe contener al menos un número");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
