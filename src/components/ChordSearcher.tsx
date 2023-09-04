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

const ChordSearch = lazy(() => import("./ChordSearch"));

export default function ChordSearcher() {
  const [search, setSearch] = useState("");
  const searchText = useDeferredValue(search);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      setSearch(ref.current.value);
    }
  }, []);
  return (
    <div>
      <input
        type="text"
        autoFocus
        className="block w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2"
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
      <div className="mt-4">
        <Suspense fallback={<Loading text="Loading app…" />}>
          <ChordSearch searchText={searchText} />
        </Suspense>
      </div>
    </div>
  );
}
