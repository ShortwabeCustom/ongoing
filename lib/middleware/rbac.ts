import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/lucia";
import { UserRole } from "@prisma/client";

type RBACCheck = {
  requireAuth?: boolean;
  allowedRoles?: UserRole[];
  checkOwnership?: (userId: string, resourceOwnerId: string) => boolean;
};

export async function checkRBAC(
  req: NextRequest,
  options: RBACCheck = {}
): Promise<{ valid: boolean; user?: any; error?: NextResponse }> {
  const {
    requireAuth = true,
    allowedRoles = [],
    checkOwnership,
  } = options;

  const session = await getSession();

  if (requireAuth && !session?.user) {
    return {
      valid: false,
      error: NextResponse.json(
        { code: "UNAUTHORIZED", message: "No autenticado" },
        { status: 401 }
      ),
    };
  }

  const user = session?.user;

  if (allowedRoles.length > 0 && user) {
    if (!allowedRoles.includes(user.role as UserRole)) {
      return {
        valid: false,
        error: NextResponse.json(
          {
            code: "FORBIDDEN",
            message: `Se requiere uno de estos roles: ${allowedRoles.join(", ")}`,
          },
          { status: 403 }
        ),
      };
    }
  }

  return {
    valid: true,
    user,
  };
}

export const RBAC_PERMISSIONS = {
  CREATE_FINDING: ["OWNER", "QA_LEAD", "DESIGNER", "DEVELOPER"],
  EDIT_FINDING_OWN: ["OWNER", "QA_LEAD", "DESIGNER", "DEVELOPER"],
  EDIT_FINDING_ANY: ["OWNER", "QA_LEAD"],
  DELETE_FINDING: ["OWNER", "QA_LEAD"],
  ASSIGN_FINDING: ["OWNER", "QA_LEAD"],
  CREATE_RESOLUTION: ["OWNER", "QA_LEAD", "DESIGNER", "DEVELOPER"],
  CHANGE_RESOLUTION_STATE_OWN: ["OWNER", "QA_LEAD", "DESIGNER", "DEVELOPER"],
  CHANGE_RESOLUTION_STATE_ANY: ["OWNER", "QA_LEAD"],
  RUN_VALIDATION: [
    "OWNER",
    "QA_LEAD",
    "DESIGNER",
    "DEVELOPER",
    "BUSINESS_REVIEWER",
  ],
  VIEW_AUDIT_LOG_OWN: ["OWNER", "QA_LEAD", "DESIGNER", "DEVELOPER"],
  VIEW_AUDIT_LOG_ANY: ["OWNER", "QA_LEAD"],
  VIEW_ALL_FINDINGS: [
    "OWNER",
    "QA_LEAD",
    "DESIGNER",
    "DEVELOPER",
    "BUSINESS_REVIEWER",
    "VIEWER",
  ],
  VIEW_ANALYTICS: ["OWNER", "QA_LEAD", "BUSINESS_REVIEWER"],
  MANAGE_USERS: ["OWNER"],
  RECEIVE_NOTIFICATIONS: [
    "OWNER",
    "QA_LEAD",
    "DESIGNER",
    "DEVELOPER",
    "BUSINESS_REVIEWER",
  ],
  SEND_NOTIFICATIONS: ["OWNER", "QA_LEAD"],
};

export function hasPermission(
  userRole: string,
  permission: keyof typeof RBAC_PERMISSIONS
): boolean {
  const allowedRoles = RBAC_PERMISSIONS[permission];
  return allowedRoles.includes(userRole);
}
