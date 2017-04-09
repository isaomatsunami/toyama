# coding: utf-8

import json
import base64
import datetime
from django.utils import timezone
from io import BytesIO
from PIL import Image

from collections import OrderedDict
from django.http import HttpResponse
from django.forms.models import modelform_factory
from django.shortcuts import get_object_or_404, render

""" RESTfulの規約
	GET /entries	エントリー一覧を取得する
	POST /entries	エントリーを追加する
	GET /entries/$entry_id	特定のエントリーを取得する
	PUT /entries/$entry_id	特定のエントリーを置き換える
	DELTE /entries/$entry_id	特定のエントリーを削除する
"""

def render_json_response(request, data, status=None):
    """responseをJSONで返す汎用関数"""
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    callback = request.GET.get('callback')
    if not callback:
        callback = request.POST.get('callback')  # POSTでJSONPの場合
    if callback:
        json_str = "%s(%s)" % (callback, json_str)
        response = HttpResponse(json_str, content_type='application/javascript; charset=UTF-8', status=status)
    else:
        response = HttpResponse(json_str, content_type='application/json; charset=UTF-8', status=status)
    return response

from toyama.models import ImageInfo, DocumentInfo

from django.contrib.auth.decorators import login_required

@login_required(login_url='/accounts/login/')
def main(request):
    context = {'user': request.user}
    return render(request, 'toyama/document.html', context)

@login_required(login_url='/accounts/login/')
def mylist(request):
    context = {'user': request.user, 'docinfos':DocumentInfo.objects.filter(owner=request.user).order_by('id')}
    return render(request, 'toyama/mylist.html', context)

@login_required(login_url='/accounts/login/')
def alllist(request):
    context = {'user': request.user, 'docinfos':DocumentInfo.objects.all().order_by('id')}
    return render(request, 'toyama/mylist.html', context)

def imageinfo(request, id):
    """ ImageInfoのREST """
    print(request.method, id)
    if request.method == 'GET':
        if id == u'':
            # このアプリのロジックの核心
            # idが指定されていない場合、次のチェック対象画像を返す
            # 複数のユーザーが同時作業をすることを想定
            # 同じ画像を複数の人が処理してしまう不合理をさけるため、
            # delegatedToにユーザーを、delegatedAtに時間を記録する
            # delegate中の30分間は他のユーザーには作業させない

            # 自分にdelegateされているものがあれば、それを再利用する
            infos = list( ImageInfo.objects.filter(done__exact=False, delegatedTo_id__exact=request.user.id).order_by('id') )
            assert len(infos) < 2, 'too many images delegated to a user'
            if len(infos) == 1:
                info = infos[0]
            else:
                # 
                try:
                    info = ImageInfo.objects.filter(done__exact=False, delegatedAt__lte=timezone.now() - datetime.timedelta(minutes=30)).order_by('id')[0]
                except IndexError:
                	print('No more ImageInfo')

            info.delegatedTo = request.user
            info.delegatedAt = timezone.now()
            info.save()

            prev_id = info.prev_image.id if info.prev_image else None
            next_id = info.next_image.id if info.next_image else None
            data = OrderedDict([
                    ('id', info.id),
                    ('page', info.page),
                    ('height', info.height),
                    ('width',  info.width),
                    ('url',  info.url()),
                    ('prev_id',  prev_id),
                    ('next_id',  next_id),
                    ('done',  info.done),
                ])
            print("CANDIDATE:", info.__str__())
            return render_json_response(request, data)
        else:
            # idがあるなら、それを返す
            info = get_object_or_404( ImageInfo, pk=int(id) )
            info.count += 1
            info.save()
            prev_id = info.prev_image.id if info.prev_image else None
            next_id = info.next_image.id if info.next_image else None
            data = OrderedDict([
                    ('id', info.id),
                    ('page', info.page),
                    ('height', info.height),
                    ('width',  info.width),
                    ('url',  info.url()),
                    ('prev_id',  prev_id),
                    ('next_id',  next_id),
                    ('done',  info.done),
                ])
            return render_json_response(request, data)
    if request.method == 'PUT':
        # done要素だけ更新する
        info = get_object_or_404( ImageInfo, pk=int(id) )
        d = json.loads(request.body.decode('UTF-8'))
        info.done = d['done']
        info.checkedBy = request.user
        assert info.delegatedTo.id == request.user.id, 'checked by non delegated user'
        info.save()
        print("UPDATED:", info.__str__())
        return render_json_response(request, d)

def int_or_none(num):
    if num == None:
        return None
    try:
        # エラーが生じないのは小数点など数値、文字列の整数（文字列の少数はだめ）
        n = int(num)
    except ValueError:
        return None
    return n

def ModelToDict(_doc):
    return OrderedDict([
        ('id', _doc.id),
        ('doc_number', _doc.doc_number),
        ('rep_name', _doc.rep_name),
        ('usage_type', _doc.usage_type),
        ('usage', _doc.usage),
        ('memo', _doc.memo),
        ('date_of_issue', _doc.date_of_issue),
        ('price', _doc.price),
        ('rate', _doc.rate),
        ('ref_image_id', _doc.ref_image_id),
        ('ref_image_left', _doc.ref_image_left),
        ('ref_image_top', _doc.ref_image_top),
        ('cap_image_id', _doc.cap_image_id),
        ('cap_image_left', _doc.cap_image_left),
        ('cap_image_top',  _doc.cap_image_top),
        ('cap_image_width', _doc.cap_image_width),
        ('cap_image_height',  _doc.cap_image_height),
        ('cap_direction', _doc.cap_direction),
        ('cap_image_base64', _doc.cap_image_base64),
    ])

def documentinfo(request, id):
    """
    	DocumentInfoのREST (https://tools.ietf.org/html/rfc7231#section-4.3)
    """
    # print(request.method, id)
    if request.method == 'GET':
        if id == u'':
            # idなしなら、ref_image_idに属する全情報を返す
            ref = int(request.GET['ref_image_id'])
            docs = []
            for doc in DocumentInfo.objects.filter(ref_image_id=ref).order_by('id'):
                docs.append( ModelToDict(doc) )
            return render_json_response(request, docs)
        else:
            # idがあるなら、それを返す
            doc = get_object_or_404( DocumentInfo, pk=int(id) )
            return render_json_response(request, ModelToDict(doc))
    if request.method == 'POST':
        # 新規追加する
        d = json.loads( request.body.decode('UTF-8') )
        print(d)
        doc = DocumentInfo(
        	# idはsaveするまでない
        	rep_name=d[u'rep_name'],
        	doc_number=d[u'doc_number'],
        	usage_type=d[u'usage_type'],
        	usage=d[u'usage'],
        	memo=d[u'memo'],
        	date_of_issue=d[u'date_of_issue'],
        	price=float(d[u'price']),
        	rate=float(d[u'rate']),
        	ref_image_left=float(d[u'ref_image_left']),
        	ref_image_top=float(d[u'ref_image_top']),
        	cap_image_left=float(d[u'cap_image_left']),
        	cap_image_top=float(d[u'cap_image_top']),
        	cap_image_width=float(d[u'cap_image_width']),
        	cap_image_height=float(d[u'cap_image_height']),
        	cap_direction=d[u'cap_direction'],
            ref_image_id = int_or_none(d[u'ref_image_id']),
            cap_image_id = int_or_none(d[u'cap_image_id']),
            owner = request.user
        )
        doc.save()
        print("CREATED:", doc.__str__())
        return render_json_response(request, ModelToDict(doc))

    if request.method == 'PUT':
        # 更新する
        doc = get_object_or_404( DocumentInfo, pk=int(id) )
        assert request.user == doc.owner, 'ownership error'
        jsonData = json.loads(request.body.decode('UTF-8'))
        # 画像処理
        imgID = int_or_none(jsonData["cap_image_id"])
        if imgID:
            imgInfo = get_object_or_404( ImageInfo, pk=imgID )

            imgDirection = jsonData["cap_direction"]
            l,t,w,h = jsonData["cap_image_left"],jsonData["cap_image_top"],jsonData["cap_image_width"],jsonData["cap_image_height"]
            imgFilename = 'toyama/static/toyama/images/pdf/images/' + imgInfo.url()
            memFile = BytesIO()
            # crop(left, upper, right, lower)
            img = Image.open( imgFilename ).crop( (int(l),int(t),int(l+w),int(t+h)) )
            if imgDirection == '右':
                img = img.transpose(Image.ROTATE_90)
            elif imgDirection == '下':
                img = img.transpose(Image.ROTATE_180)
            elif imgDirection == '左':
                img = img.transpose(Image.ROTATE_270)
            img.save(memFile, format="JPEG")
            doc.cap_image_base64 = 'data:image/jpeg;base64,' + base64.b64encode( memFile.getvalue() ).decode('utf-8')
            # print(doc.cap_image_base64)

        doc.overwrite(jsonData)
        doc.save()
        print("UPDATED:", doc.__str__())
        return render_json_response(request, ModelToDict(doc))

    if request.method == 'DELETE':
        # 削除する
        doc = get_object_or_404( DocumentInfo, pk=int(id) )
        print("DELETED:", doc.__str__())
        doc.delete()
        return render_json_response(request, {})
