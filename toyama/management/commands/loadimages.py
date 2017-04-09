#!/usr/bin/env python
# -*- coding: utf-8 -*-

import glob, os
from PIL import Image
from django.core.management.base import BaseCommand

from toyama.models import ImageInfo
import datetime
from django.utils import timezone

class Command(BaseCommand):
    def handle(self, *args, **options):
        # delete all ImageInfo
        for obj in ImageInfo.objects.all():
            obj.delete()
        # print os.getcwd()
        for image_dir in glob.glob('toyama/static/toyama/images/pdf/images/*'):
            print(image_dir)
            parent_dir = image_dir.split('/')[-1]
            imageInfos = []
            nPages = len(glob.glob(image_dir + '/*.jpg'))
            for n in range( nPages ):
                image_file = image_dir + '/page_{0}.jpg'.format(n+1)
                print( image_file )
                img = Image.open(image_file)
                imgInfo = ImageInfo(
                    directory = parent_dir,
                    nPages = nPages,
                    page = n,
                    filename = 'page_{0}.jpg'.format(n+1),
                    width = img.size[0],
               	    height = img.size[1],
               	    # 30分以上前に設定する
               	    delegatedAt = timezone.now() - datetime.timedelta(minutes=30)
                )
                imgInfo.save()
                imageInfos.append(imgInfo)
            for i in range( nPages ):
                if i != 0:
                    imageInfos[i].prev_image = imageInfos[i-1]
                if i != nPages - 1:
                    imageInfos[i].next_image = imageInfos[i+1]
                imageInfos[i].save()


