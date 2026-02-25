from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = "page_size"
    max_page_size = 200


class OptionalPagination(DefaultPagination):
    def paginate_queryset(self, queryset, request, view=None):
        if request.query_params.get(self.page_query_param) is None:
            return None
        return super().paginate_queryset(queryset, request, view=view)
