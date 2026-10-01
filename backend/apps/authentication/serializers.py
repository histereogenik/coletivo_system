from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.authentication.capabilities import (
    ALL_CAPABILITY_KEYS,
    get_user_capabilities,
    set_user_capabilities,
)
from apps.authentication.models import OperatorProfile

User = get_user_model()


class CookieTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds a server-controlled session version to operator JWTs."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        profile = getattr(user, "operator_profile", None)
        if profile is not None:
            token["auth_version"] = profile.auth_version
        return token


class OperatorAccountSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    capabilities = serializers.ListField(
        child=serializers.ChoiceField(choices=ALL_CAPABILITY_KEYS),
        allow_empty=False,
        required=False,
        write_only=True,
    )
    granted_capabilities = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "display_name",
            "is_active",
            "last_login",
            "password",
            "capabilities",
            "granted_capabilities",
        ]
        read_only_fields = ["id", "display_name", "last_login", "granted_capabilities"]

    def get_display_name(self, instance):
        return instance.get_full_name() or instance.get_username()

    def get_granted_capabilities(self, instance):
        return get_user_capabilities(instance)

    def validate_username(self, value):
        return value.strip().lower()

    def validate_password(self, value):
        validate_password(value, self.instance)
        return value

    def validate(self, attrs):
        if self.instance is None:
            if not attrs.get("password"):
                raise serializers.ValidationError({"password": "Informe uma senha inicial."})
            if not attrs.get("capabilities"):
                raise serializers.ValidationError(
                    {"capabilities": "Selecione ao menos uma área de acesso."}
                )
        return attrs

    def create(self, validated_data):
        capabilities = validated_data.pop("capabilities", None)
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, is_staff=False, **validated_data)
        OperatorProfile.objects.create(user=user, created_by=self.context["request"].user)
        set_user_capabilities(user, capabilities)
        return user

    def update(self, instance, validated_data):
        capabilities = validated_data.pop("capabilities", None)
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        if capabilities is not None:
            set_user_capabilities(instance, capabilities)
        return instance
