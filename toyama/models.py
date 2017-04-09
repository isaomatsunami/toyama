#!/usr/bin/env python
# -*- coding: utf-8 -*-

from __future__ import unicode_literals
from django.db import models
from django.core.validators import validate_comma_separated_integer_list
from django.contrib.auth.models import User

import datetime
from django.utils import timezone

class ImageInfo(models.Model):
	# idは自動付加されるものを利用する
    prev_image = models.ForeignKey('self', models.SET_NULL, related_name="prevs", related_query_name="prev", blank=True, null=True) # 同一文書の前の画像のID（ない場合は）
    next_image = models.ForeignKey('self', models.SET_NULL, related_name="nexts", related_query_name="next", blank=True, null=True) # 同一文書の前の画像のID（ない場合は）

    directory = models.CharField(max_length=50) # 画像が所属するディレクトリ名
    nPages = models.IntegerField() # ディレクトリ内の画像数
    page = models.IntegerField() # 画像の順番
    count = models.IntegerField(default=0) # 表示回数

    filename = models.CharField(max_length=50) # 画像ファイル名
    height = models.FloatField()
    width = models.FloatField()

    delegatedAt = models.DateTimeField(default=None, blank=True, null=True)
    delegatedTo = models.ForeignKey(User, models.SET_NULL, default=None, related_name="delagates", related_query_name="delagate", blank=True, null=True)

    done = models.BooleanField(default=False)
    checkedBy   = models.ForeignKey(User, models.SET_NULL, default=None, related_name="owners", related_query_name="owner", blank=True, null=True)

    def url(self):
    	return self.directory + u'/' + self.filename

    def __str__(self):
    	return self.filename + u'({0:d})'.format(self.pk)

class DocumentInfo(models.Model):
    """ 支出情報 """
    rep_name = models.CharField(max_length=50, default=u'') # 議員名
    doc_number = models.CharField(max_length=10, default=u'') # 整理番号
    usage_type = models.CharField(max_length=50, default=u'') # 使途分類
    usage = models.CharField(max_length=50, default=u'') # 使途但し書き
    memo = models.CharField(max_length=200, default=u'') # メモ

    date_of_issue = models.CharField(max_length=50, default=u'') # 日時
    price = models.FloatField(default=0.0) # 金額
    rate  = models.FloatField(default=100.0) # 率

    # 同一文書の前の画像のID（ない場合は）
    ref_image_id = models.IntegerField(blank=True, null=True, default=None)
    ref_image_left = models.FloatField(default=0.0)
    ref_image_top  = models.FloatField(default=0.0)

    cap_image_id = models.IntegerField(blank=True, null=True, default=None)
    # left, top, width, heightの順の整数。未定義の場合はは空白
    cap_image_left = models.FloatField(default=0.0)
    cap_image_top  = models.FloatField(default=0.0)
    cap_image_width  = models.FloatField(default=0.0)
    cap_image_height = models.FloatField(default=0.0)
    cap_direction = models.CharField(default='上',max_length=10) # 向き
    cap_image_base64 = models.TextField(default='', blank=True)

    owner = models.ForeignKey(User, models.SET_NULL, blank=True, null=True)


    def overwrite(self, doc_dict):
    	self.rep_name = doc_dict[u'rep_name']
    	self.doc_number = doc_dict[u'doc_number']
    	self.usage_type = doc_dict[u'usage_type']
    	self.usage = doc_dict[u'usage']
    	self.memo = doc_dict[u'memo']
    	self.date_of_issue = doc_dict[u'date_of_issue']
    	self.price = doc_dict[u'price']
    	self.rate = doc_dict[u'rate']
    	self.ref_image_id = doc_dict[u'ref_image_id']
    	self.ref_image_left = doc_dict[u'ref_image_left']
    	self.ref_image_top = doc_dict[u'ref_image_top']
    	self.cap_image_id = doc_dict[u'cap_image_id']
    	self.cap_image_left = doc_dict[u'cap_image_left']
    	self.cap_image_top = doc_dict[u'cap_image_top']
    	self.cap_image_width = doc_dict[u'cap_image_width']
    	self.cap_image_height = doc_dict[u'cap_image_height']
    	self.cap_direction = doc_dict[u'cap_direction']

    def __str__(self):
    	return u'DocumentInfo({0:d})'.format(self.pk)

