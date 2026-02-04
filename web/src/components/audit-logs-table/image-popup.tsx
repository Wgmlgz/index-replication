'use client';
import JsonView from '@uiw/react-json-view';
import React, { PureComponent } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import * as yaml from '@std/yaml';
import * as toml from '@std/toml';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Eye, EyeIcon, Image, X } from 'lucide-react';
import { ModelsRecognizedSkuDetection } from '@/api-client';
import { ImageWithBoxes, SkuDetectionExtra } from '../image-with-boxes';
import { cn } from '@/lib/utils';
import { ButtonGroup } from '../ui/button-group';
import { Button } from '../ui/button';

export function ImagePopup({
  url,
  results,
  className,
  coverClassName,
}: {
  className?: string;
  coverClassName?: string;
  url: string;
  results: ModelsRecognizedSkuDetection[] | null;
}) {
  return (
    <Dialog>
      <DialogTrigger className='relative'>
        <img
          src={url}
          alt={`image`}
          className={cn(
            'w-16 h-16 object-contain rounded-lg border',
            className
          )}
          onError={e => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div
          className={cn(
            'absolute rounded-lg inset-0 backdrop-blur-md bg-opacity-50 group-hover:bg-opacity-50 transition-all flex items-center justify-center opacity-0 hover:opacity-100',
            coverClassName
          )}
        >
          <EyeIcon className='h-4 w-4'></EyeIcon>
        </div>
      </DialogTrigger>
      <DialogContent className='max-w-[1000px]! max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Image className='h-5 w-5' />
            Изображение
          </DialogTitle>
        </DialogHeader>

        {/* <img
        src={url}
        alt={`image`}
        className="w-full max-h-[50svh] object-contain rounded border"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
       */}
        <ImageWithBoxes image={url} results={results ?? []}></ImageWithBoxes>
      </DialogContent>
    </Dialog>
  );
}
