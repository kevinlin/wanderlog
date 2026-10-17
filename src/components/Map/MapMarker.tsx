import { useGoogleMap } from '@react-google-maps/api';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface MapMarkerProps {
  centred?: boolean; // anchorTop '-50%' for diamonds, discs and dots; pins keep the bottom-centre anchor
  children: React.ReactNode;
  collisionBehavior?: google.maps.CollisionBehavior;
  onClick?: () => void;
  onHoverChange?: (rect: DOMRect | null) => void; // mouse pointers only
  position: google.maps.LatLngLiteral;
  title: string;
  zIndex: number;
}

const HOVER_LIFT = 100;

const anchorTopFor = (centred: boolean | undefined) => (centred ? '-50%' : '-100%');

export const MapMarker: React.FC<MapMarkerProps> = (props) => {
  const { position, title, zIndex, centred, collisionBehavior, children } = props;
  const map = useGoogleMap();
  // Held in state so the same element survives StrictMode's double mount.
  const [content] = useState(() => document.createElement('div'));
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  // The listeners below are bound once per marker; reading through a ref keeps them from
  // seeing a stale zIndex or callback without ever being rebound.
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!map) return;
    const current = propsRef.current;
    // Every current prop goes in at construction, so a marker recreated for a new map is
    // complete even when no prop changed. `content` goes through the constructor because
    // the instance setter is deprecated, and clicks use gmp-click because addListener and
    // 'click' were deprecated in 3.66.
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      content,
      gmpClickable: true,
      position: current.position,
      title: current.title,
      zIndex: current.zIndex,
      collisionBehavior: current.collisionBehavior,
      anchorTop: anchorTopFor(current.centred),
    });
    markerRef.current = marker;

    const handleClick = () => propsRef.current.onClick?.();
    const handlePointerEnter = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      marker.zIndex = propsRef.current.zIndex + HOVER_LIFT;
      propsRef.current.onHoverChange?.(content.getBoundingClientRect());
    };
    const handlePointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      marker.zIndex = propsRef.current.zIndex;
      propsRef.current.onHoverChange?.(null);
    };

    marker.addEventListener('gmp-click', handleClick);
    content.addEventListener('pointerenter', handlePointerEnter);
    content.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      marker.removeEventListener('gmp-click', handleClick);
      content.removeEventListener('pointerenter', handlePointerEnter);
      content.removeEventListener('pointerleave', handlePointerLeave);
      marker.map = null;
      markerRef.current = null;
    };
  }, [map, content]);

  useEffect(() => {
    if (markerRef.current) markerRef.current.position = { lat: position.lat, lng: position.lng };
  }, [position.lat, position.lng]);

  useEffect(() => {
    if (markerRef.current) markerRef.current.title = title;
  }, [title]);

  useEffect(() => {
    if (markerRef.current) markerRef.current.zIndex = zIndex;
  }, [zIndex]);

  useEffect(() => {
    if (markerRef.current) markerRef.current.collisionBehavior = collisionBehavior;
  }, [collisionBehavior]);

  useEffect(() => {
    if (markerRef.current) markerRef.current.anchorTop = anchorTopFor(centred);
  }, [centred]);

  if (!map) return null;
  return createPortal(children, content);
};
