from typing import Any, Dict


def check_privacy(context: Dict[str, Any]) -> Dict[str, Any]:
    pii_fields = context.get("piiFields", [])
    allowed = context.get("allowPii", False)
    passed = allowed or not pii_fields
    return {"policy": "privacy", "passed": passed, "piiFields": pii_fields}


def check_retention(context: Dict[str, Any]) -> Dict[str, Any]:
    ttl_days = context.get("retentionDays", 90)
    passed = 0 < ttl_days <= 365
    return {"policy": "retention", "passed": passed, "retentionDays": ttl_days}


def check_access(context: Dict[str, Any]) -> Dict[str, Any]:
    role = context.get("role", "viewer")
    required = context.get("requiredRole", "reviewer")
    levels = {"viewer": 0, "reviewer": 1, "admin": 2}
    passed = levels.get(role, 0) >= levels.get(required, 1)
    return {"policy": "access", "passed": passed, "role": role}


def check_compliance(context: Dict[str, Any]) -> Dict[str, Any]:
    region = context.get("region", "global")
    blocked = region in context.get("blockedRegions", [])
    passed = not blocked
    return {"policy": "compliance", "passed": passed, "region": region}


def check_all_policies(context: Dict[str, Any]) -> Dict[str, Any]:
    checks = [
        check_privacy(context),
        check_retention(context),
        check_access(context),
        check_compliance(context),
    ]
    return {
        "passed": all(c["passed"] for c in checks),
        "checks": checks,
    }
