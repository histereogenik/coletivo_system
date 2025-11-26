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
