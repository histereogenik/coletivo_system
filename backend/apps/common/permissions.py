from rest_framework.permissions import BasePermission


class SuperuserOnly(BasePermission):
    message = "Apenas superusuários podem acessar este recurso."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class SuperuserOrReadOnly(BasePermission):
    message = "Apenas superusuários podem modificar este recurso."

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class AreaPermission(BasePermission):
    message = "Você não possui permissão para acessar esta área."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        if request.method in ("GET", "HEAD", "OPTIONS"):
            read_permissions = getattr(view, "read_area_permissions", ())
            if any(user.has_perm(permission) for permission in read_permissions):
                return True
        permission = getattr(view, "area_permission", None)
        return bool(permission and user.has_perm(permission))


class AnyAreaPermission(BasePermission):
    message = "Você não possui permissão para acessar este recurso."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        permissions = getattr(view, "area_permissions", ())
        return any(user.has_perm(permission) for permission in permissions)
