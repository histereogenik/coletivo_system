# Coletivo Backend

API Django REST Framework do Coletivo System.

O guia completo de instalação, Docker, testes e produção está no
[README da raiz](../README.md). Os contratos e as regras de cada domínio ficam em [DOCS](DOCS).

Comandos locais principais:

```bash
poetry install
poetry run python manage.py migrate
poetry run pytest
poetry run python manage.py runserver
```

O projeto requer Python 3.12.
