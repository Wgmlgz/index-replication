import { ModelsDetectResponse, ModelsRecognizedSkuDetection, ModelsRect } from '@/api-client';
import { useEffect, useRef, useState } from 'react';
import { ButtonGroup } from './ui/button-group';
import { Button } from './ui/button';
import { downloadImage, filterDetects, filterOneDetects } from '@/lib/utils';
import { Download, PlusIcon, Trash2, X } from 'lucide-react';
import { Drawable, RectComponentRef } from './object-detection-uploader/drawable';
import { useImage } from 'react-konva-utils';

export type SkuDetectionExtra = ModelsRecognizedSkuDetection & { msg?: string };

interface BoundingBoxProps {
  rect: { x: number; y: number; w: number; h: number };
  label: string;
  confidence: number;
  color: string;
  backgroundColor: string;
  textColor: string;
}

const BoundingBox: React.FC<BoundingBoxProps> = ({
  rect,
  label,
  confidence,
  color,
  backgroundColor,
  textColor,
}) => {
  const boxStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
    border: '2px solid ' + color,
    color: textColor,
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    backgroundColor,
  };

  const textStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${rect.x}px`,
    top: `${rect.y - 20}px`,
    backgroundColor: color,
    color: textColor,
    padding: '2px 5px',
    borderRadius: '3px',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  };

  return (
    <>
      <div style={boxStyle} className='transition-colors' />
      {label || confidence ? (
        <div style={textStyle} className='transition-colors'>
          {label} ({confidence.toFixed(3)})
        </div>
      ) : (
        ''
      )}
    </>
  );
};

export function ImageWithBoxes({
  results,
  image,
  onImageDimensions,
  hoveredIndex,
  selectedIndex,
  manualMode,
  onRectsChange
}: {
  results: SkuDetectionExtra[] | null;
  image: string;
  onImageDimensions?: (dims: {
    naturalWidth: number;
    naturalHeight: number;
    displayWidth: number;
    displayHeight: number;
    xOffset: number;
    yOffset: number;
  }) => void;
  hoveredIndex?: number;
  selectedIndex?: number;
  manualMode?: boolean;
  onRectsChange?: (rects: ModelsRect[]) => void

}) {
  const [imageElement] = useImage(image || '');

  const imgRef = useRef<HTMLImageElement>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredDetectionIndex, setHoveredDetectionIndex] = useState<number | null>(null);

  const [imageDimensions, setImageDimensions] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    displayWidth: 0,
    displayHeight: 0,
    xOffset: 0,
    yOffset: 0,
  });
  const [displayResults, setDisplayResults] = useState<SkuDetectionExtra[] | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'FILTERED' | 'BEST' | 'ORIGINAL' | 'HOVER'>('ALL')
  const [editSelectedIndex, setEditSelectedIndex] = useState<number | null>(null);
  const rectComponentRef = useRef<RectComponentRef>(null);

  useEffect(() => {
    if (filter === 'ALL') setDisplayResults(results);
    else if (filter === 'FILTERED') setDisplayResults(filterDetects(results ?? []));
    else if (filter === 'BEST') setDisplayResults(filterOneDetects(results ?? [], imageDimensions));
    else if (filter === 'ORIGINAL') setDisplayResults([]);
    else if (filter === 'HOVER') {
      // In HOVER mode, initially show no detections
      setDisplayResults([]);
      setHoveredDetectionIndex(null);
    }
  }, [filter, results, imageDimensions])

  // Update hovered detection when mouse moves
  useEffect(() => {
    if (filter !== 'HOVER' || !mousePosition || !results) {
      setHoveredDetectionIndex(null);
      return;
    }

    // Find the detection that contains the mouse cursor
    let foundIndex = null;

    for (let i = 0; i < results.length; i++) {
      const detection = results[i];

      const scaleX = imageDimensions.displayWidth / imageDimensions.naturalWidth;
      const scaleY = imageDimensions.displayHeight / imageDimensions.naturalHeight;

      const rect = {
        x: detection.rect.x * scaleX,
        y: detection.rect.y * scaleY,
        w: detection.rect.w * scaleX,
        h: detection.rect.h * scaleY,
      };

      // Check if mouse is inside this rectangle
      if (
        mousePosition.x >= rect.x &&
        mousePosition.x <= rect.x + rect.w &&
        mousePosition.y >= rect.y &&
        mousePosition.y <= rect.y + rect.h
      ) {
        if (foundIndex == null) {
          foundIndex = i;
        } else {
          // If overlap set to smallest
          const oldS = results[foundIndex].rect.w * results[foundIndex].rect.h;
          const newS = results[i].rect.w * results[i].rect.h;
          if (oldS > newS) {
            foundIndex = i;
          }
        }
      }
    }

    setHoveredDetectionIndex(foundIndex);

    // Update display results to only show the hovered detection
    if (foundIndex !== null) {
      setDisplayResults([results[foundIndex]]);
    } else {
      setDisplayResults([]);
    }
  }, [mousePosition, filter, results, imageDimensions]);

  const handleImageLoad = () => {
    if (imgRef.current) {
      const naturalWidth = imgRef.current.naturalWidth;
      const naturalHeight = imgRef.current.naturalHeight;
      const clientWidth = imgRef.current.clientWidth;
      const clientHeight = imgRef.current.clientHeight;

      let displayWidth = clientWidth;
      let displayHeight = clientHeight;
      let xOffset = 0;
      let yOffset = 0;

      const aspectRatio = naturalWidth / naturalHeight;
      const containerAspectRatio = clientWidth / clientHeight;

      if (aspectRatio > containerAspectRatio) {
        // Image is wider than container, height will be contained (letterbox)
        displayHeight = clientWidth / aspectRatio;
        yOffset = (clientHeight - displayHeight) / 2;
      } else {
        // Image is taller than container, width will be contained (pillarbox)
        displayWidth = clientHeight * aspectRatio;
        xOffset = (clientWidth - displayWidth) / 2;
      }
      const dims = {
        naturalWidth,
        naturalHeight,
        displayWidth,
        displayHeight,
        xOffset,
        yOffset,
      };
      if (onImageDimensions) {
        onImageDimensions(dims);
      }
      setImageDimensions(dims);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (filter !== 'HOVER') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - imageDimensions.xOffset;
    const y = e.clientY - rect.top - imageDimensions.yOffset;

    setMousePosition({ x, y });
  };

  const handleMouseLeave = () => {
    if (filter !== 'HOVER') return;

    setMousePosition(null);
    setHoveredDetectionIndex(null);
    setDisplayResults([]);
  };

  const visSelector = (index: number, {
    FULL,
    HIDDEN,
    MID
  }: {
    FULL: string,
    HIDDEN: string,
    MID: string
  }) => {
    let a = FULL
    if (selectedIndex != null) {
      if (index !== selectedIndex) a = HIDDEN
    }
    if (hoveredIndex != null) {
      if (index !== hoveredIndex) {
        if (index !== selectedIndex) a = MID
        else a = FULL
      }
      else a = FULL
    }
    return a
  }
  const colorSelector = (detection: SkuDetectionExtra, index: number) => {
    const a = visSelector(index, {
      FULL: "F",
      HIDDEN: "0",
      MID: "7"
    })
    return (detection.msg ? '#AAA' : '#00F') + a
  }

  const backgroundColorSelector = (detection: SkuDetectionExtra, index: number) => {
    const a = visSelector(index, {
      FULL: "0.3",
      HIDDEN: "0.0",
      MID: "0.1"
    })
    return detection.msg
      ? `rgba(200, 200, 200, ${a})`
      : `rgba(0, 0, 255, ${a})`
  }
  const textColorSelector = (detection: SkuDetectionExtra, index: number) => {
    const a = visSelector(index, {
      FULL: "F",
      HIDDEN: "0",
      MID: "7"
    })
    return '#FFF' + a
  }


  return (
    <div className='flex items-center flex-col gap-4'>
      <div
        className='relative'
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <img
          ref={imgRef}
          src={image}
          alt='Uploaded'
          className='w-full rounded-lg shadow-md object-contain max-h-96 mx-auto'
          onLoad={handleImageLoad}
        />
        {!manualMode ? (displayResults && imageDimensions.displayWidth > 0) && (
          <>
            <div
              className='absolute inset-0'
              style={{
                left: imageDimensions.xOffset,
                top: imageDimensions.yOffset,
                width: imageDimensions.displayWidth,
                height: imageDimensions.displayHeight,
              }}
            >
              {displayResults.map((detection, index) => {
                const scaleX =
                  imageDimensions.displayWidth / imageDimensions.naturalWidth;
                const scaleY =
                  imageDimensions.displayHeight / imageDimensions.naturalHeight;

                return (
                  <BoundingBox
                    key={index}
                    rect={{
                      x: detection.rect.x * scaleX,
                      y: detection.rect.y * scaleY,
                      w: detection.rect.w * scaleX,
                      h: detection.rect.h * scaleY,
                    }}
                    label={(detection.msg || '') + detection.sku}
                    confidence={detection.confidence}
                    color={colorSelector(detection, index)}
                    backgroundColor={backgroundColorSelector(detection, index)}
                    textColor={textColorSelector(detection, index)}
                  />
                );
              })}

            </div>
          </>
        ) :
          <div
            className='absolute inset-0'
            style={{
              left: imageDimensions.xOffset,
              top: imageDimensions.yOffset,
              width: imageDimensions.displayWidth,
              height: imageDimensions.displayHeight,
            }}
          >
            {imageElement &&
              <Drawable
                image={imageElement}
                ref={rectComponentRef}
                onSelectedChange={setEditSelectedIndex}
                onRectsChange={onRectsChange}
              />
            }
          </div>
        }
      </div>
      <p className=''>
        {imageDimensions.naturalWidth} x {imageDimensions.naturalHeight}
      </p>

      {manualMode ?
        <ButtonGroup>
          <Button
            size='sm'
            variant={'outline'} onClick={rectComponentRef.current?.handleAddRect}>
            <PlusIcon />
          </Button>
          <Button
            size='sm'
            variant={'destructive'}
            onClick={rectComponentRef.current?.handleDeleteSelected}
            disabled={selectedIndex === null}
          >
            <Trash2 />
          </Button>
        </ButtonGroup>
        :
        ((results && results.length != 0) ?
          <div className='grid justify-items-center gap-0'>
            <ButtonGroup className='w-full'>
              <Button size='sm' className="flex-grow rounded-b-none" variant={filter === 'ALL' ? "default" : "secondary"} onClick={() => setFilter('ALL')}>Все</Button>
              <Button size='sm' className="flex-grow rounded-b-none" variant={filter === 'FILTERED' ? "default" : "secondary"} onClick={() => setFilter('FILTERED')}>Фильтр</Button>
              <Button size='sm' className="flex-grow rounded-b-none" variant={filter === 'BEST' ? "default" : "secondary"} onClick={() => setFilter('BEST')}>Лучший</Button>
            </ButtonGroup>
            <ButtonGroup>
              <Button size='sm' className="flex-grow rounded-t-none" variant={filter === 'ORIGINAL' ? "default" : "secondary"} onClick={() => setFilter('ORIGINAL')}>Оригинал</Button>
              <Button size='sm' className="flex-grow rounded-t-none" variant={filter === 'HOVER' ? "default" : "secondary"} onClick={() => setFilter('HOVER')}>Наведение</Button>
              <Button size='sm' className="flex-grow rounded-t-none" variant='secondary' onClick={() => downloadImage('image', image)}>
                <Download />
              </Button>

            </ButtonGroup>
          </div> :
          <Button size='sm' className="flex-grow" variant='secondary' onClick={() => downloadImage('image', image)}>
            <Download />
          </Button>
        )}
    </div>
  );
}