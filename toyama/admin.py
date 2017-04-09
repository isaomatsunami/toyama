from django.contrib import admin

from toyama.models import ImageInfo, DocumentInfo

class ImageInfoAdmin(admin.ModelAdmin):
    list_display = ("__str__", "count", "checkedBy", "delegatedTo", "delegatedAt", "nPages", "page",)
admin.site.register(ImageInfo, ImageInfoAdmin)

class DocumentInfoAdmin(admin.ModelAdmin):
    list_display = ("__str__", "owner", "rep_name", "price", "rate", "date_of_issue")
admin.site.register(DocumentInfo, DocumentInfoAdmin)