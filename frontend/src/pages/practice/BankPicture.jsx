import React, { useState } from "react";
import Icon from "../../components/Icon.jsx";
import { Modal } from "./PlayerParts.jsx";

// A picture that belongs to a bank question: a graph or table that goes with the passage, or the
// whole question (or its explanation) for questions that exist only as a picture. `image` is
// { src, w, h }, served by the backend from /api/bank-media; w and h are its size on the printed
// page, in points. The pictures are dark print on white, so they sit on a white card in both themes.
//
// `zoom` is how much larger than the printed page a picture is shown: the print is 10.5 pt, and 1.5
// brings it level with the app's own text. Where there isn't room (a phone, the side panel) it is
// never shrunk below its printed size: the card scrolls sideways instead, and the button in its
// corner opens the picture full size.
export default function BankPicture({ image, alt, className = "", zoom = 1.5 }) {
  const [open, setOpen] = useState(false);
  if (!image?.src) return null;
  const src = `/api/bank-media/${image.src}`;
  return (
    <figure className={`pl-pic ${className}`}>
      {/* Clicking the picture opens it too; the button is there for the keyboard and for clarity. */}
      <img src={src} width={image.w} height={image.h} alt={alt} draggable={false} onClick={() => setOpen(true)} style={{ width: `min(${Math.round(image.w * zoom)}px, max(100%, ${image.w}px))` }} />
      <button type="button" className="pl-pic-zoom" onClick={() => setOpen(true)} aria-label="Open the picture full size" title="Open full size">
        <Icon name="search" size={16} />
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} label="Picture, full size" className="pl-pic-modal">
          <button type="button" className="pl-iconbtn pl-pic-close" onClick={() => setOpen(false)} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
          <div className="pl-pic-full">
            <img src={src} width={image.w} height={image.h} alt={alt} draggable={false} style={{ width: Math.round(image.w * 1.9) }} />
          </div>
        </Modal>
      )}
    </figure>
  );
}

// Questions that exist only as a picture have nothing to read in their options: the choices are
// in the picture, and the buttons carry the letters.
export const isPictureQuestion = (q) => Boolean(q?.promptImage);
