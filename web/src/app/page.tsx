'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  X,
  Image as ImageIcon,
  Camera,
  BookImage,
  SquareDashed,
  Layers,
  Square,
  CheckCircle2Icon,
  Check,
  PencilLine,
  BookmarkIcon,
  SquarePen,
} from 'lucide-react';
import { Toggle } from "@/components/ui/toggle"
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { isTauri, recognitionApi } from '@/lib/api';
import { ModelsDetectResponse, ModelsRecognizedSkuDetection, ModelsRect } from '@/api-client/api';
import { isAxiosError } from 'axios';
import {
  filterDetects,
  filterOneDetects,
  getDefaultThreshold,
  getOneOtherThreshold,
  getOneThreshold,
} from '@/lib/utils';
import Webcam from 'react-webcam';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog-full';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  ImageWithBoxes,
  SkuDetectionExtra,
} from '@/components/image-with-boxes';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Drawable } from '@/components/object-detection-uploader/drawable';
import { useImage } from 'react-konva-utils';
import _ from 'lodash';

function PhotoTake({
  handleFileSelect,
  setError,
}: {
  handleFileSelect: (file: File) => void;
  setError: (e: string | null) => void;
}) {
  const webcamRef = useRef<Webcam>(null);

  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleDevices = useCallback(
    (mediaDevices: MediaDeviceInfo[]) => {
      setDevices(mediaDevices.filter(({ kind }) => kind === 'videoinput'));
    },
    [setDevices]
  );

  const capture = async () => {
    // if (!webcamRef.current) return;

    // if ('ImageCapture' in window && stream) {
    //   try {
    //     const track = stream.getVideoTracks()[0];
    //     if (track) {
    //       const imageCapture = new ImageCapture(track);
    //       const blob = await imageCapture.takePhoto();
    //       const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
    //       handleFileSelect(file);
    //       return;
    //     }
    //   } catch (err) {
    //     console.error('ImageCapture error:', err);
    //     setError('Ошибка захвата с ImageCapture: ' + (err as Error).message);
    //   }
    // }

    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
          handleFileSelect(file);
        })
        .catch(err => {
          setError('Ошибка захвата фото: ' + err.message);
        });
    }
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className='border-3 border-dashed border-slate-300 rounded-xl p-8 md:p-12 text-center cursor-pointer transition-all hover:border-slate-400'>
          <Camera className='w-12 h-12 mx-auto mb-4' />
          <p className='text-lg font-medium '>Или сделайте фото</p>
          <p className='text-sm  mt-1'> нажмите для съемки</p>
        </div>
      </DialogTrigger>
      <DialogContent className='w-full'>
        <div className='px-6'>
          <DialogHeader>
            <DialogTitle>Сделайте снимок</DialogTitle>
            <DialogDescription>
              Снимок получится лучше при использовании приложения камеры
              устройства
            </DialogDescription>
          </DialogHeader>
          <div className='mt-4 grid grid-cols-2 gap-2'>
            {devices.map((device, key) => (
              <Button key={key} onClick={() => setDeviceId(device.deviceId)}>
                {/* <Webcam audio={false} videoConstraints={{ deviceId: device.deviceId }} /> */}
                {device.label || `Device ${key + 1}`}
              </Button>
            ))}
          </div>
        </div>

        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat='image/jpeg'
          className='w-full'
          videoConstraints={{
            facingMode: 'environment',
            deviceId: deviceId ?? undefined,
            // width: { ideal: 3072 },
            // height: { ideal: 4080 },
            // width: { ideal: 4096 },
            // height: { ideal: 2160 }
            width: {
              ideal: 9999999
            }
          }}
          forceScreenshotSourceSize={true}
          onUserMedia={(s) => {
            setStream(s);
            navigator.mediaDevices.enumerateDevices().then(handleDevices);
          }}
        />
        <DialogFooter>
          <ButtonGroup className='w-full grid grid-cols-2 px-6'>
            <Button onClick={capture} type='submit'>
              <Camera></Camera>
              Сделать снимок
            </Button>
            <DialogClose asChild>
              <Button variant='outline'>Отмена</Button>
            </DialogClose>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [imageElement] = useImage(image || '');
  const [loading, setLoading] = useState<{
    progress: number;
    info: string;
  } | null>(null);
  const [results, setResults] = useState<SkuDetectionExtra[] | null>(null);
  const [filteredResults, setFilteredResults] = useState<
    SkuDetectionExtra[] | null
  >(null);
  const [displayResults, setDisplayResults] = useState<
    SkuDetectionExtra[] | null
  >(null);
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>();
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>();
  const [imageDimensions, setImageDimensions] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    displayWidth: 0,
    displayHeight: 0,
    xOffset: 0,
    yOffset: 0,
  });
  const [manualMode, setManualMode] = useState(false);
  const [rects, setRects] = useState<
    ModelsDetectResponse['rects']
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetDetectState = () => {
    setLoading(null);
    setResults(null);
    setFilteredResults(null);
    setDisplayResults(null);
    setShowOriginal(false);
    setError(null);
    setSelectedIndex(undefined);
    setHoveredIndex(undefined);
  };
  const resetImageState = () => {
    setFile(null);
    setImage(null);
    setImageDimensions({
      naturalWidth: 0,
      naturalHeight: 0,
      displayWidth: 0,
      displayHeight: 0,
      xOffset: 0,
      yOffset: 0,
    });
  };
  const reset = () => {
    resetDetectState();
    resetImageState();
  };

  const pr = new Intl.PluralRules('ru-Ru');

  useEffect(() => {
    if (!image) setShowOriginal(false);
  }, [image]);

  useEffect(() => {
    if (showOriginal) {
      setDisplayResults(results);
    } else {
      setDisplayResults(filteredResults);
    }
  }, [results, showOriginal]);

  const recognizeSku = async (
    file: File,
    isSingle: boolean
  ): Promise<ModelsRecognizedSkuDetection[]> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = (reader.result as string)?.split(',')?.[1] || reader.result;
        resolve(res as any);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const { data } = await recognitionApi.recognitionRecognizePost(
      { image: base64 },
      isSingle
    );
    // console.log(data);
    const res = data.detections || [];
    const sortedConfidence = res.sort((a, b) => b.confidence - a.confidence);
    return sortedConfidence;
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    try {
      // Step 1: Read as data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Step 2: Load into Image and draw on canvas
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not available');

      ctx.drawImage(img, 0, 0);

      // Step 3: Convert canvas to JPEG Blob
      const jpegBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create JPEG blob'));
          },
          'image/jpeg',
          0.92 // quality: 0.92 is a sweet spot (good quality + decent compression)
        );
      });

      // Step 4: Create new File object
      const newFileName = file.name.replace(/\.[^/.]+$/i, '') + '.jpg'; // ensure .jpg extension
      const jpegFile = new File([jpegBlob], newFileName, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      // Step 5: Update states with the new JPEG file
      const newDataUrl = URL.createObjectURL(jpegFile); // for preview
      setImage(newDataUrl);
      setFile(jpegFile);           // now it's a real JPEG File
      setResults(null);
      setDisplayResults(null);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Ошибка при обработке изображения');
    }
  };

  const recognizeMultiple = async () => {
    if (file == null) return;
    uploadImage(file, false);
  };

  const recognizeSingle = async () => {
    if (file == null) return;
    uploadImage(file, true);
  };

  const recognizeDraw = async () => {
    if (file == null || !imageElement) return;

    const croppedImageDatas: [ModelsRect, string][] = [];
    rects.forEach(rect => {
      const canvas = document.createElement('canvas');
      canvas.width = rect.w;
      canvas.height = rect.h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          imageElement,
          rect.x,
          rect.y,
          rect.w,
          rect.h,
          0,
          0,
          rect.w,
          rect.h
        );
        croppedImageDatas.push([rect, canvas.toDataURL('image/jpeg').split(',')[1]]); // Or image/png
      }
    });

    resetDetectState();
    try {
      let completedTasks = 0;
      const totalTasks = croppedImageDatas.length;

      setLoading({ info: 'Поиск объектов', progress: 10 });
      const all = await Promise.all(croppedImageDatas.map(async ([rect, b64]) => {
        const { data } = await recognitionApi.recognitionRecognizePost(
          { image: b64 },
          true,
          true
        );
        console.log(data);
        const res = data.detections || [];
        const sortedConfidence = res.map(x => ({
          ...x,
          rect: rect
        }));

        // Update progress after each completion
        completedTasks++;
        const progress = 10 + Math.round((completedTasks / totalTasks) * 90);
        setLoading({ info: 'Поиск объектов', progress: progress });
        return sortedConfidence;
      }))

      const sortedConfidence = _.flatten(all).toSorted((a, b) => b.confidence - a.confidence);
      setManualMode(false)
      setResults(sortedConfidence);
      setFilteredResults(sortedConfidence);
    } catch (err) {
      if (isAxiosError(err)) {
        const axiosError = err.response?.data?.error;
        setError(err.message + (axiosError ? ': ' + axiosError : ''));
      } else {
        setError('Неизвестная ошибка распознавания. Попробуйте другое фото.');
      }
    } finally {
      setLoading(null);
    }
  };
  const uploadImage = async (file: File, isSingle: boolean) => {
    resetDetectState();
    try {
      if (isSingle) {
        setLoading({ info: 'Поиск объекта', progress: 33 });
      } else {
        setLoading({ info: 'Поиск нескольких объектов', progress: 66 });
      }
      const rawRes = await recognizeSku(file, isSingle);
      let res = [...rawRes];
      if (
        isSingle &&
        (res.length === 0 || [res[0]?.confidence < getDefaultThreshold()])
      ) {
        setLoading({
          info: 'Поиск наиболее подходящего объекта',
          progress: 66,
        });
        const unsorted = await recognizeSku(file, false);
        // const unsorted: ModelsRecognizedSkuDetection[] = [
        //   {
        //     confidence: 0.7,
        //     rect: {
        //       x: 100,
        //       y: 100,
        //       w: 100,
        //       h: 100,
        //     },
        //     sku: 'A_sku',
        //   },
        //   {
        //     confidence: 0.1,
        //     rect: {
        //       x: 120,
        //       y: 120,
        //       w: 100,
        //       h: 100,
        //     },
        //     sku: 'B_sku',
        //   },
        //   {
        //     confidence: 0.1,
        //     rect: {
        //       x: 140,
        //       y: 140,
        //       w: 100,
        //       h: 100,
        //     },
        //     sku: 'B_sku',
        //   },
        // ];
        let rawRes: ModelsRecognizedSkuDetection[] = JSON.parse(
          JSON.stringify(unsorted)
        );

        res = filterOneDetects(unsorted, imageDimensions);

        setResults(rawRes);
        setFilteredResults(res);
      } else {
        setResults(res);
        setFilteredResults(res ? filterDetects(res) : null);
      }
    } catch (err) {
      if (isAxiosError(err)) {
        const axiosError = err.response?.data?.error;
        setError(err.message + (axiosError ? ': ' + axiosError : ''));
      } else {
        setError('Неизвестная ошибка распознавания. Попробуйте другое фото.');
      }
    } finally {
      setLoading(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const openFilePicker = () => {
    console.log(fileInputRef);
    fileInputRef.current?.click();
  };

  return (
    <>
      <div className='max-w-2xl mx-auto relative'>
        <Card className='shadow-xl'>
          <CardHeader className='text-center pb-4'>
            <CardTitle className='text-2xl md:text-3xl font-bold'>
              Распознавание изображений
            </CardTitle>
            <p className='text-sm mt-1'>
              Загрузите фото — получите результат распознавания
            </p>
          </CardHeader>
          <CardContent className='space-y-6'>
            {/* Upload Area */}
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              className='hidden'
              onChange={e =>
                e.target.files?.[0] && handleFileSelect(e.target.files[0])
              }
            />
            {!image ? (
              <div className='grid grid-cols-2 gap-4'>
                {isTauri() ? (
                  <div
                    className='border-3 border-dashed border-slate-300 rounded-xl p-8 md:p-12 text-center cursor-pointer transition-all hover:border-slate-400'
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={openFilePicker}
                  >
                    <BookImage className='w-12 h-12 mx-auto mb-4' />
                    <p className='text-lg font-medium '>Нажмите для выбора</p>
                  </div>
                ) : (
                  <div
                    className='border-3 border-dashed border-slate-300 rounded-xl p-8 md:p-12 text-center cursor-pointer transition-all hover:border-slate-400'
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={openFilePicker}
                  >
                    <Upload className='w-12 h-12 mx-auto mb-4' />
                    <p className='text-lg font-medium '>Перетащите фото сюда</p>
                    <p className='text-sm  mt-1'>или нажмите для выбора</p>
                  </div>
                )}
                <PhotoTake
                  setError={setError}
                  handleFileSelect={handleFileSelect}
                ></PhotoTake>
              </div>
            ) : (
              <ImageWithBoxes
                image={image}
                results={displayResults}
                onImageDimensions={setImageDimensions}
                onRectsChange={setRects}
                hoveredIndex={hoveredIndex}
                selectedIndex={selectedIndex}
                manualMode={manualMode}
              />
            )}

            {file && (
              <div className='flex gap-3 justify-center items-center'>
                <p>
                  Распознать:
                </p>
                <ButtonGroup>
                  {manualMode ?
                    <>
                      <Button
                        size="sm"
                        disabled={loading != null}
                        onClick={recognizeDraw}>
                        <SquarePen></SquarePen>
                        Выделенные
                      </Button>
                    </>
                    :
                    <>
                      <Button
                        size="sm"
                        disabled={loading != null}
                        onClick={recognizeSingle}>
                        <Square></Square>
                        Объект
                      </Button>
                      <Button
                        size="sm"

                        disabled={loading != null}
                        onClick={recognizeMultiple}
                      >
                        <Layers></Layers>
                        Несколько
                      </Button>
                    </>
                  }

                  {/* <Toggle variant="outline" aria-label="Toggle italic" disabled={loading != null}>
                    <PencilLine></PencilLine>
                    Выделить
                  </Toggle> */}
                  <Toggle
                    aria-label="Toggle auto"
                    size="sm"
                    onPressedChange={setManualMode}
                    pressed={manualMode}
                    variant="outline"
                    className="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-blue-500 data-[state=on]:*:[svg]:stroke-blue-500"
                  >
                    <PencilLine></PencilLine>
                    Выделить
                  </Toggle>
                  {/* <Button
                    disabled={loading != null}
                    onClick={recognizeDraw}
                  >
                  </Button> */}
                </ButtonGroup>
              </div>
            )}
            {/* Action Buttons */}
            {image && !loading && (
              <div className='flex gap-3 justify-center'>
                <ButtonGroup>
                  <Button
                    onClick={reset}
                    variant='outline'
                    className='flex items-center gap-2'
                  >
                    <ImageIcon className='w-4 h-4' />
                    Заменить фото
                  </Button>
                  <Button
                    onClick={() => setShowOriginal(x => !x)}
                    variant='outline'
                    className='flex items-center gap-2'
                  >
                    <SquareDashed className='w-4 h-4' />
                    {showOriginal
                      ? 'Показать оригинал'
                      : 'Показать все объекты'}
                  </Button>
                </ButtonGroup>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className='space-y-3'>
                <p className='text-center text-slate-600'>{loading.info}</p>
                <Progress value={loading.progress} className='h-2' />
              </div>
            )}

            {/* Result */}
            {displayResults && (
              <Alert variant={'default'}>
                <CheckCircle2Icon />
                <AlertTitle>
                  Успешно:{' '}
                  {
                    {
                      zero: 'Найдено',
                      one: 'Найден',
                      two: 'Найдено',
                      few: 'Найдено',
                      many: 'Найдено',
                      other: 'Найдено',
                    }[pr.select(displayResults.length)]
                  }{' '}
                  {displayResults.length}{' '}
                  {
                    {
                      zero: 'объектов',
                      one: 'объект',
                      two: 'объекта',
                      few: 'объекта',
                      many: 'объектов',
                      other: 'объектов',
                    }[pr.select(displayResults.length)]
                  }
                </AlertTitle>
                <AlertDescription>
                  <ul className='list-inside list-disc text-sm w-full max-h-[200px] overflow-y-auto'>
                    <ButtonGroup orientation='vertical'>
                      {displayResults.map((r, index) => (
                        <div key={index} className='flex items-center gap-2'>
                          <Button
                            className='text-left'
                            variant={index === selectedIndex ? 'link' : 'ghost'}
                            onClick={() =>
                              setSelectedIndex(selectedIndex =>
                                index === selectedIndex ? undefined : index
                              )
                            }
                          // onPointerOver={() => setHoveredIndex(index)}
                          // onPointerLeave={() => {
                          //   if (hoveredIndex === index)
                          //     setHoveredIndex(undefined);
                          // }}
                          >
                            {r.sku}: {r.confidence.toFixed(3)}
                          </Button>
                          {index === selectedIndex && (
                            <Check className='w-4 h-4' />
                          )}
                        </div>
                      ))}
                    </ButtonGroup>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Error */}
            {error && (
              <Alert variant='destructive'>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent >
        </Card >

        <p className='text-center text-xs text-slate-500 mt-6'>Демо-версия</p>
      </div >
    </>
  );
}
