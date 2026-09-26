"use client";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "./button";
import { useApp } from "../context";

export function SubmitDialog({
  open,
  onOpenChange,
  onConfirm,
  attempt,
  max,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onConfirm: () => void;
  attempt: number;
  max: number;
}) {
  const { lang } = useApp();
  const ru = lang === "ru";
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="confirm-overlay" />
        <AlertDialog.Content className="confirm-dialog">
          <span className="eyebrow">
            {ru ? "Попытка" : "Әрекет"} {attempt} / {max}
          </span>
          <AlertDialog.Title>
            {ru
              ? "Сдать домашнее задание?"
              : "Үй тапсырмасын тапсыру керек пе?"}
          </AlertDialog.Title>
          <AlertDialog.Description>
            {ru
              ? "Ответы будут проверены сразу. Отправка использует одну попытку — изменить её результат уже нельзя."
              : "Жауаптар бірден тексеріледі. Жіберу бір әрекетті пайдаланады, оның нәтижесін өзгерту мүмкін емес."}
          </AlertDialog.Description>
          <div className="confirm-actions">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">
                {ru ? "Проверить ответы" : "Жауаптарды тексеру"}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button onClick={onConfirm}>
                {ru ? "Сдать и увидеть результат" : "Тапсырып, нәтижені көру"}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
