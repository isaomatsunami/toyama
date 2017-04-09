# coding: utf-8

from django.conf.urls import url
from django.conf import settings
from django.conf.urls.static import static

from toyama import views as toyama_views

urlpatterns = [
    # html
    url(r'^$', toyama_views.main, name='main'),
    url(r'^mylist$', toyama_views.mylist, name='mylist'),
    url(r'^alllist$', toyama_views.alllist, name='alllist'),
    # RESTful
    url(r'^api/imageinfos/(?P<id>.*)$', toyama_views.imageinfo, name='imageinfo'),
    url(r'^api/documentinfos/(?P<id>.*)$', toyama_views.documentinfo, name='documentinfo'),
] + static(settings.STATIC_URL, document_root='toyama/static/')
