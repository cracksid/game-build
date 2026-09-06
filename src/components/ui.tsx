/**
 * The small shared controls: buttons that click, switches, segmented
 * pickers, modals, avatars and the floating background.
 *
 * They all play their own sound, so no screen has to remember to.
 */

import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { playSound } from "../audio/sound";
import type { SoundName } from "../audio/sound";
import type { ColorId } from "../engine/types";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "sky" | "purple" | "coral" | "mint" | "sun" | "pink" | "ghost";
  size?: "sm" | "md" | "lg";
  sound?: SoundName | null;
  children: ReactNode;
};

export function Button({
  variant = "sky",
  size = "md",
  sound = "click",
  className = "",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    "btn",
    variant !== "sky" ? "btn--" + variant : "",
    size !== "md" ? "btn--" + size : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={(event) => {
        if (sound) playSound(sound);
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  state?: "on" | "off" | null;
  children: ReactNode;
};

export function IconButton({
  label,
  state = null,
  className = "",
  onClick,
  children,
  ...rest
}: IconButtonProps) {
  const classes = ["icon-btn", state ? "icon-btn--" + state : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      title={label}
      onClick={(event) => {
        playSound("click");
        onClick?.(event);
      }}
      {...rest}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

export function Switch({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        playSound("toggle");
        onChange(!checked);
      }}
    >
      <span className="row">
        <span aria-hidden="true" style={{ fontSize: "1.4em" }}>
          {icon}
        </span>
        <span>{label}</span>
      </span>
      <span className={"switch__track" + (checked ? " switch__track--on" : "")}>
        <span className="switch__knob" aria-hidden="true">
          {checked ? "✓" : ""}
        </span>
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={option.value === value}
          onClick={() => {
            playSound("select");
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({
  emoji,
  color,
  size = "2.2em",
  className = "",
}: {
  emoji: string;
  color?: ColorId;
  size?: string;
  className?: string;
}) {
  return (
    <span
      className={"avatar" + (color ? " avatar--" + color : "") + " " + className}
      // The badge's own font-size IS its size, so the emoji inside can be
      // expressed as a fraction of the badge rather than of whatever text
      // happens to surround it.
      style={{ fontSize: size, width: "1em", height: "1em" }}
      aria-hidden="true"
    >
      <span style={{ fontSize: "0.62em", lineHeight: 1 }}>{emoji}</span>
    </span>
  );
}

/**
 * A modal that traps nothing but does the two things that actually matter:
 * Escape closes it, and focus moves inside when it opens.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  children,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: ReactNode;
  dismissable?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissable) onClose();
    };
    window.addEventListener("keydown", onKey);
    const focusable = ref.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (dismissable) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        ref={ref}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Clouds, balloons and stars drifting behind everything. Positions are fixed
 * per item rather than random per render, so they do not jump when React
 * re-renders the screen around them.
 */
const DECOR_ITEMS = [
  { emoji: "☁️", left: "6%", top: "12%", size: "3.4rem", duration: 64, drift: true },
  { emoji: "☁️", left: "40%", top: "5%", size: "2.6rem", duration: 88, drift: true },
  { emoji: "☁️", left: "70%", top: "22%", size: "3rem", duration: 76, drift: true },
  { emoji: "🎈", left: "88%", top: "62%", size: "2.6rem", duration: 9, drift: false },
  { emoji: "🎈", left: "5%", top: "70%", size: "2.2rem", duration: 11, drift: false },
  { emoji: "⭐", left: "18%", top: "36%", size: "1.7rem", duration: 7, drift: false },
  { emoji: "⭐", left: "82%", top: "18%", size: "1.4rem", duration: 8.5, drift: false },
  { emoji: "✨", left: "62%", top: "78%", size: "1.8rem", duration: 6.5, drift: false },
  { emoji: "🌈", left: "30%", top: "84%", size: "2.4rem", duration: 12, drift: false },
];

export function Decor() {
  return (
    <div className="decor" aria-hidden="true">
      {DECOR_ITEMS.map((item, i) => (
        <span
          key={i}
          className={"decor__item" + (item.drift ? " decor__item--drift" : "")}
          style={{
            left: item.drift ? undefined : item.left,
            top: item.top,
            fontSize: item.size,
            animationDuration: item.duration + "s",
            animationDelay: -(i * 3.5) + "s",
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
}
