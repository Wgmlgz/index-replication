import {
  Stage,
  Layer,
  Rect,
  Image as KonvaImage,
  Transformer,
} from 'react-konva';
import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ModelsDetectResponse,
  Configuration,
  RecognitionApi,
  ModelsRect,
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

interface DraggableRectProps {
  rect: ModelsDetectResponse['rects'][number];
  onTransform: (newRect: ModelsDetectResponse['rects'][number]) => void;
  isSelected: boolean;
  onSelect: () => void;
  displayScale: number;
}

const DraggableRect: React.FC<DraggableRectProps> = ({
  rect,
  onTransform,
  isSelected,
  onSelect,
  displayScale,
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    } else if (trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    // onSelect()
    onTransform({
      x: node.x() / displayScale,
      y: node.y() / displayScale,
      w: Math.max(5 / displayScale, (node.width() * scaleX) / displayScale),
      h: Math.max(5 / displayScale, (node.height() * scaleY) / displayScale),
    });
  };

  const scaledRect = {
    x: rect.x * displayScale,
    y: rect.y * displayScale,
    w: rect.w * displayScale,
    h: rect.h * displayScale,
  };

  return (
    <React.Fragment>
      <Rect
        x={scaledRect.x}
        y={scaledRect.y}
        width={scaledRect.w}
        height={scaledRect.h}
        stroke={isSelected ? '#ff6467' : '#1447e6'}
        strokeWidth={2}
        draggable
        onTap={onSelect}
        onClick={onSelect}
        onDragEnd={handleTransformEnd}
        onTransformEnd={handleTransformEnd}
        ref={shapeRef}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          anchorSize={16}
          borderStrokeWidth={0}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};

interface RectComponentProps {
  image: HTMLImageElement
  onSelectedChange?: (idx: number | null) => void
  onRectsChange?: (rects: ModelsRect[]) => void
}

export interface RectComponentRef {
  handleAddRect: () => void;
  handleDeleteSelected: () => void;
  setNewRects: (rects: ModelsRect[]) => void
}


export const Drawable = forwardRef<RectComponentRef, RectComponentProps>((
  { image, onSelectedChange, onRectsChange }, ref) => {
  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [displayDimensions, setDisplayDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [displayScale, setDisplayScale] = useState<number>(1);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const [adjustedRects, setAdjustedRects] = useState<
    ModelsDetectResponse['rects']
  >([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);


  const updateDisplayDimensions = useCallback(() => {
    if (!naturalDimensions || !stageContainerRef.current) return;
    const containerWidth = stageContainerRef.current.clientWidth;
    const containerHeight = stageContainerRef.current.clientHeight;
    console.log(containerHeight, containerWidth)

    if (containerWidth <= 0) return;
    if (containerHeight <= 0) return;
    const scale = Math.min(
      1,
      containerWidth / naturalDimensions.width,
      containerHeight / naturalDimensions.height
    );
    setDisplayScale(scale);
    setDisplayDimensions({
      width: naturalDimensions.width * scale,
      height: naturalDimensions.height * scale,
    });
  }, [naturalDimensions]);

  useEffect(() => {
    updateDisplayDimensions()
  }, [image])

  useEffect(() => {
    window.addEventListener('resize', updateDisplayDimensions);
    return () => window.removeEventListener('resize', updateDisplayDimensions);
  }, [updateDisplayDimensions]);

  useEffect(() => {
    updateDisplayDimensions();
  }, [updateDisplayDimensions]);

  useEffect(() => {
    if (onSelectedChange) {
      onSelectedChange(selectedIndex);
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (onRectsChange) {
      onRectsChange(adjustedRects);
    }
  }, [adjustedRects]);


  const handleRectTransform = (
    index: number,
    newRect: ModelsDetectResponse['rects'][number]
  ) => {
    setAdjustedRects(prevRects =>
      prevRects.map((rect, i) => (i === index ? newRect : rect))
    );
  };

  useEffect(() => {
    if (image) {
      setNaturalDimensions({ width: image.width, height: image.height });
    } else {
      setNaturalDimensions(null);
    }
  }, [image]);

  const handleAddRect = () => {
    if (!image) {
      toast.error("No image loaded");
      return;
    }

    const newRect = {
      x: image.width / 3,
      y: image.height / 3,
      h: image.height / 3,
      w: image.width / 3,
    };

    setAdjustedRects(prev => {
      const newRects = [...prev, newRect];
      // Set selectedIndex to the new rect's index
      setSelectedIndex(newRects.length - 1);
      return newRects;
    });
  };


  const handleDeleteSelected = () => {
    if (selectedIndex === null) return;
    setAdjustedRects(prev => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
  };

  const setNewRects = (rects: ModelsRect[]) => {
    setAdjustedRects(rects || []);
    setSelectedIndex(null);
  }
  useImperativeHandle(ref, () => ({
    handleAddRect,
    handleDeleteSelected,
    setNewRects,
  }));

  return <div className=' w-full h-full rounded-lg shadow-md' ref={stageContainerRef}>
    {displayDimensions &&
      <Stage
        width={displayDimensions.width}
        height={displayDimensions.height}
      >
        <Layer>
          <KonvaImage
            image={image}
            width={displayDimensions.width}
            height={displayDimensions.height}
          />
          {adjustedRects.map((rect, index) => (
            <DraggableRect
              key={index}
              rect={rect}
              onTransform={newRect =>
                handleRectTransform(index, newRect)
              }
              isSelected={index === selectedIndex}
              onSelect={() => setSelectedIndex(index)}
              displayScale={displayScale}
            />
          ))}
        </Layer>
      </Stage>
    }
  </div>
})