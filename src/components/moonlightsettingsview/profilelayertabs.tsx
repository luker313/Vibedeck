import { DialogButton, Focusable } from "@decky/ui";
import { ReactElement } from "react";

interface Props<T extends string> {
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  setValue: (value: T) => void;
}

export function ProfileLayerTabs<T extends string>({ options, value, setValue }: Props<T>): ReactElement {
  return (
    <Focusable style={{ display: "flex", gap: "8px", margin: "12px 0", padding: "6px 0", position: "sticky", top: 0, zIndex: 2, background: "#1b2838" }}>
      {options.map((option) => (
        <DialogButton
          key={option.id}
          aria-pressed={value === option.id}
          onClick={() => setValue(option.id)}
          style={{ flex: 1, minWidth: 0, padding: "10px 6px", background: value === option.id ? "#235b85" : undefined }}
        >
          {option.label}
        </DialogButton>
      ))}
    </Focusable>
  );
}
