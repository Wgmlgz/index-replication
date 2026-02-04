import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ModelsDetectResponse,
  Configuration,
  RecognitionApi,
} from '@/api-client';

import { useImage } from 'react-konva-utils';
import { recognitionApi } from '@/lib/api';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Brain,
  Image,
  PlusIcon,
  SquareDashed,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Drawable, RectComponentRef } from './drawable';

interface ObjectDetectionUploaderProps {
  onImageProcessed: (imageDatas: string[]) => void; // Modified to accept array of image data
}


const ObjectDetectionUploader: React.FC<ObjectDetectionUploaderProps> = ({
  onImageProcessed,
}) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [rects, setRects] = useState<
    ModelsDetectResponse['rects']
  >([]);
  const rectComponentRef = useRef<RectComponentRef>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image] = useImage(imagePreview || '');


  const handleImageChange = (
    file: File
    // event: React.ChangeEvent<HTMLInputElement> | React.DragEvent
  ) => {
    // const file = ;
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        rectComponentRef.current?.setNewRects([]);
      };
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreview(null);
      rectComponentRef.current?.setNewRects([]);
    }
  };

  const handleDetectObjects = async () => {
    if (!imageFile || !imagePreview) {
      setError('Please select an image first.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const base64Image = imagePreview.split(',')[1];

      const { data } = await recognitionApi.recognitionDetectPost({
        image: base64Image,
      });

      rectComponentRef.current?.setNewRects(data.rects);
    } catch (err) {
      toast.error('Object detection failed');
      setError('Failed to detect objects. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  const handleProcessImage = () => {
    if (!image) {
      setError('No image to process.');
      return;
    }

    const croppedImageDatas: string[] = [];
    rects.forEach(rect => {
      const canvas = document.createElement('canvas');
      canvas.width = rect.w;
      canvas.height = rect.h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          image,
          rect.x,
          rect.y,
          rect.w,
          rect.h,
          0,
          0,
          rect.w,
          rect.h
        );
        croppedImageDatas.push(canvas.toDataURL('image/jpeg')); // Or image/png
      }
    });

    onImageProcessed(croppedImageDatas);
  };



  // const handleFileSelect = (file: File) => {
  //   if (!file.type.startsWith('image/')) {
  //     setError('Пожалуйста, выберите изображение');
  //     return;
  //   }

  //   const reader = new FileReader();
  //   reader.onloadend = () => {
  //     setImage(reader.result as string);
  //     setResults(null);
  //     setDisplayResults(null);
  //     setError(null);
  //     setFile(file);
  //   };
  //   reader.readAsDataURL(file);
  // };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // handleImageChange(e)
    const file = e.dataTransfer.files[0];
    if (file) handleImageChange(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const openFilePicker = () => {
    console.log(fileInputRef);
    fileInputRef.current?.click();
  };


  return (
    <div className='space-y-4 h-[600px]!'>
      <div className='grid md:grid-cols-2 gap-2'>
        <ButtonGroup>
          <ButtonGroup>
            <Button
              onClick={handleDetectObjects}
              disabled={!imageFile || loading}
            >
              {loading ? (
                'Detecting...'
              ) : (
                <>
                  <Brain />
                  Распознать
                  {/* <SquareDashed /> */}
                </>
              )}
            </Button>
          </ButtonGroup>

          <ButtonGroup>
            <Button variant={'outline'} onClick={rectComponentRef.current?.handleAddRect}>
              <PlusIcon />
            </Button>
            <Button
              variant={'destructive'}
              onClick={rectComponentRef.current?.handleDeleteSelected}
              disabled={selectedIndex === null}
            >
              <Trash2 />
            </Button>
          </ButtonGroup>
        </ButtonGroup>
        <div>
          <div className='flex items-center gap-2'>
            {/* {imagePreview && (
              <div
                className='border-3 border-dashed border-slate-300 rounded-xl  text-center  flex cursor-pointer transition-all hover:border-slate-400'
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={openFilePicker}
              >
                <Upload className='w-12 h-12 mx-auto mb-4' />
                <p className=''>
                  Перетащите фото сюда или нажмите для выбора
                </p>
              </div>
            )} */}
            {/* <Label htmlFor="image">Image</Label> */}
            {/* {imagePreview && (<Input
              ref={fileInputRef}
              id='image'
              type='file'
              accept='image/*'
              onChange={e =>
                e.target.files?.[0] && handleImageChange(e.target.files[0])
              }
            />)} */}
          </div>
        </div>
      </div>

      {error && <p className='text-red-500 text-sm'>{error}</p>}
      {(rects.length ?? 0) > 0 && (
        <p className='text-sm text-green-600'>
          Найдено {rects.length} об. Измените при необходимости.
        </p>
      )}
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        className='hidden'
        onChange={e =>
          e.target.files?.[0] && handleImageChange(e.target.files[0])
        }
      />
      <div className='flex flex-col w-full items-center gap-4 h-[450px]!'>
        <div className='relative w-full h-full'>
          {imagePreview && image ? (
            <Drawable
              ref={rectComponentRef}
              image={image}
              onSelectedChange={setSelectedIndex}
              onRectsChange={setRects}
            />
          ) : (
            <div
              className='h-full grid justify-items-center items-center border-3 border-dashed border-slate-300 rounded-xl p-8 md:p-12 text-center cursor-pointer transition-all hover:border-slate-400'
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={openFilePicker}
            >
              <div>
                <Upload className='w-12 h-12 mx-auto mb-4' />
                <p className='text-lg font-medium '>Перетащите фото сюда</p>
                <p className='text-sm  mt-1'>или нажмите для выбора</p>
              </div>
            </div>
          )}
        </div>

        {(rects.length ?? 0) > 0 && imagePreview && (
          <Button onClick={handleProcessImage}>
            Использовать текущие объекты
          </Button>
        )}
      </div>
    </div>
  );
};

export default ObjectDetectionUploader;
