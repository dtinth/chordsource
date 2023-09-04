import { atom } from "nanostores";

export const voiceActive = atom(false);

let current: { cancel: () => void } | null = null;

export function isSpeechRecognitionSupported() {
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export function toggleVoiceSearch(callback: (text: string) => void) {
  if (current) {
    current.cancel();
    current = null;
    return;
  }
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = "th-TH";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onresult = function (event: any) {
    const speechResult = event.results[0][0].transcript;
    if (speechResult) callback(speechResult);
  };
  voiceActive.set(true);
  recognition.onend = function () {
    current = null;
    voiceActive.set(false);
  };
  recognition.start();
  current = {
    cancel: () => {
      current = null;
      voiceActive.set(false);
      recognition.abort();
    },
  };
}
