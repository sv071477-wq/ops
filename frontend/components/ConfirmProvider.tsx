"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PromptOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  minLength?: number;
  /** Shown under the field when the user clicks confirm with an invalid value. */
  validationMessage?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
type PromptFn = (options: PromptOptions) => Promise<string | null>;

const ConfirmContext = createContext<ConfirmFn | null>(null);
const PromptContext = createContext<PromptFn | null>(null);

interface PendingPrompt extends PromptOptions {
  value: string;
  error: string | null;
}

/**
 * Promise-based confirmation and prompt dialogs, replacing blocking
 * `window.confirm()` / `window.prompt()` calls with accessible in-app UI.
 * Mount `<ConfirmProvider>` once near the app root.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [prompt, setPrompt] = useState<PendingPrompt | null>(null);
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);
  const promptResolver = useRef<((value: string | null) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
    });
  }, []);

  const requestPrompt = useCallback<PromptFn>((opts) => {
    setPrompt({ ...opts, value: opts.defaultValue ?? "", error: null });
    return new Promise<string | null>((resolve) => {
      promptResolver.current = resolve;
    });
  }, []);

  const settleConfirm = useCallback((value: boolean) => {
    setOptions(null);
    confirmResolver.current?.(value);
    confirmResolver.current = null;
  }, []);

  const settlePrompt = useCallback(
    (value: string | null) => {
      setPrompt(null);
      promptResolver.current?.(value);
      promptResolver.current = null;
    },
    []
  );

  const submitPrompt = useCallback(() => {
    if (!prompt) return;
    const trimmed = prompt.value.trim();
    if (prompt.minLength && trimmed.length < prompt.minLength) {
      setPrompt({
        ...prompt,
        error: prompt.validationMessage ?? `Must be at least ${prompt.minLength} characters`,
      });
      return;
    }
    settlePrompt(trimmed);
  }, [prompt, settlePrompt]);

  const confirmValue = useMemo(() => confirm, [confirm]);
  const promptValue = useMemo(() => requestPrompt, [requestPrompt]);

  return (
    <ConfirmContext.Provider value={confirmValue}>
      <PromptContext.Provider value={promptValue}>
        {children}

        <Dialog
          open={options !== null}
          onOpenChange={(open) => {
            if (!open) settleConfirm(false);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{options?.title}</DialogTitle>
              {options?.description && (
                <DialogDescription>{options.description}</DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={() => settleConfirm(false)}>
                {options?.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                type="button"
                variant={options?.destructive ? "destructive" : "default"}
                onClick={() => settleConfirm(true)}
              >
                {options?.confirmLabel ?? "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={prompt !== null}
          onOpenChange={(open) => {
            if (!open) settlePrompt(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{prompt?.title}</DialogTitle>
              {prompt?.description && (
                <DialogDescription>{prompt.description}</DialogDescription>
              )}
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitPrompt();
              }}
            >
              {prompt?.multiline ? (
                <Textarea
                  autoFocus
                  rows={3}
                  value={prompt.value}
                  placeholder={prompt.placeholder}
                  aria-invalid={prompt.error ? "true" : "false"}
                  onChange={(e) => setPrompt({ ...prompt, value: e.target.value, error: null })}
                />
              ) : (
                <Input
                  autoFocus
                  value={prompt?.value ?? ""}
                  placeholder={prompt?.placeholder}
                  aria-invalid={prompt?.error ? "true" : "false"}
                  onChange={(e) =>
                    prompt && setPrompt({ ...prompt, value: e.target.value, error: null })
                  }
                />
              )}
              {prompt?.error && (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  {prompt.error}
                </p>
              )}
              <DialogFooter className="mt-4 gap-3">
                <Button type="button" variant="outline" onClick={() => settlePrompt(null)}>
                  {prompt?.cancelLabel ?? "Cancel"}
                </Button>
                <Button type="submit">
                  {prompt?.confirmLabel ?? "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PromptContext.Provider>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}

export function usePrompt(): PromptFn {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error("usePrompt must be used within a ConfirmProvider");
  }
  return context;
}
