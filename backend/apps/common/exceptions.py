import logging

from django.db import DatabaseError, DataError, IntegrityError
from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("apps.api")


def custom_exception_handler(exc, context):
    if isinstance(exc, ProtectedError):
        return Response(
            {
                "detail": (
                    "Não é possível excluir este registro porque ele está vinculado "
                    "a outros dados."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )

    response = exception_handler(exc, context)
    if response is not None:
        return response

    if isinstance(exc, (DataError, IntegrityError, DatabaseError)):
        logger.error(
            "Erro de banco de dados não tratado na API.",
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        return Response(
            {
                "detail": (
                    "Não foi possível salvar os dados da operação. "
                    "Tente consultar a situação antes de repetir a ação."
                ),
                "code": "data_storage_error",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    logger.error(
        "Erro não tratado na API.",
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return Response(
        {
            "detail": "Ocorreu um erro interno. Tente novamente ou contate o suporte.",
            "code": "internal_error",
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
