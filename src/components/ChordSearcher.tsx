import {
  Suspense,
  lazy,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loading } from "./Loading";
import { eventHandlers } from "./eventHandlers";
import { Icon } from "react-iconify-icon-wrapper";
import {
  isSpeechRecognitionSupported,
  toggleVoiceSearch,
  voiceActive,
} from "./speech";
import { useStore } from "@nanostores/react";

const ChordSearch = lazy(() => import("./ChordSearch"));

export default function ChordSearcher() {
  const [search, setSearch] = useState("");
  const [voiceSearchSupported, setVoiceSearchSupported] = useState(false);
  const searchText = useDeferredValue(search);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      setSearch(ref.current.value);
    }
  }, []);
  useEffect(() => {
    setVoiceSearchSupported(isSpeechRecognitionSupported());
  }, []);
  return (
    <div>
      <div className="flex gap-3 items-center">
        <input
          type="search"
          autoFocus
          className="flex-auto block w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2"
          placeholder="ชื่อเพลง หรือ ศิลปิน"
          ref={ref}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              e.stopPropagation();
              eventHandlers.onUp();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              e.stopPropagation();
              eventHandlers.onDown();
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              document
                .querySelector<HTMLAnchorElement>('[data-selected="true"]')
                ?.click();
              return;
            }
          }}
        />
        {!!search && (
          <button
            className={
              "flex-none w-12 h-12 rounded-full  text-white border flex items-center justify-center bg-slate-800 border-slate-700"
            }
            onClick={() => {
              if (ref.current) {
                ref.current.value = "";
                ref.current.focus();
              }
              setSearch("");
            }}
          >
            <Icon inline icon="material-symbols:close" />
          </button>
        )}
        {voiceSearchSupported && (
          <VoiceSearchButton
            onText={(text) => {
              if (ref.current) {
                ref.current.value = text;
              }
              setSearch(text);
            }}
          />
        )}
      </div>
      <div className="mt-4 text-lg">
        <Suspense fallback={<Loading text="Loading app…" />}>
          <ChordSearch searchText={searchText} />
        </Suspense>
      </div>
    </div>
  );
}

interface VoiceSearchButton {
  onText: (text: string) => void;
}
function VoiceSearchButton(props: VoiceSearchButton) {
  const active = useStore(voiceActive);
  return (
    <button
      className={
        "flex-none w-12 h-12 rounded-full  text-white border flex items-center justify-center " +
        (active
          ? "bg-green-500 border-green-200"
          : "bg-slate-800 border-slate-700")
      }
      onClick={() => {
        toggleVoiceSearch(props.onText);
      }}
    >
      <Icon inline icon="material-symbols:mic-outline" />
    </button>
  );
}
