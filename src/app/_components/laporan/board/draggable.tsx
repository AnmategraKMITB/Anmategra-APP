import { useDraggable } from '@dnd-kit/core';
import React from 'react';

interface Props {
  id: string;
  children: React.ReactNode;
}

export function Draggable(props: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: props.id,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <button ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {props.children}
    </button>
  );
}
