import { useStore } from "@nanostores/react";
import { Loading } from "./Loading";
import { atom } from "nanostores";
import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { get, set } from "idb-keyval";
import fuzzysort from "fuzzysort";
import { eventHandlers } from "./eventHandlers";
import { convert } from "gode.js";

let active = false;

export interface ChordItem {
  id: string;
  title: string;
  artist: string;
  url: string;
}

const $chords = atom([] as PreparedChordItem[]);
const $loadingStatus = atom("กำลังโหลดข้อมูลล่าสุด");

function getUnknownRev() {
  return String(Math.floor(new Date().getTime() / 300e3));
}

export interface PreparedChordItem extends ChordItem {
  search: Fuzzysort.Prepared;
}

function prepareForSearch(items: ChordItem[]): PreparedChordItem[] {
  return items.map((item) => {
    return {
      ...item,
      search: fuzzysort.prepare(
        item.title + " " + item.artist + " " + item.title
      ),
    };
  });
}

async function reloadData(rev: string) {
  const url = "https://db.chord.source.in.th/data.json?rev=" + rev;

  // Use XMLHttpRequest instead of fetch() to be able to track progress
  const chords = await new Promise<ChordItem[]>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "json";
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(new Error(xhr.statusText));
      }
    });
    xhr.addEventListener("error", () => {
      reject(new Error(xhr.statusText));
    });
    xhr.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        $loadingStatus.set(
          `กำลังโหลดข้อมูลล่าสุด (${Math.round((e.loaded / e.total) * 100)}%)`
        );
      }
    });
    xhr.send();
  });

  $chords.set(prepareForSearch(chords));

  return chords;
}

async function ensureData() {
  const latestData = await get("chordsource");
  if (Array.isArray(latestData?.data)) {
    $chords.set(prepareForSearch(latestData.data));
    const { hash } = await getLatestMetadata();
    if (latestData.hash === hash) {
      return;
    }
    const data = await reloadData(hash);
    await set("chordsource", { data, hash });
  } else {
    const latestMetadataPromise = getLatestMetadata();
    const data = await reloadData(getUnknownRev());
    const { hash } = await latestMetadataPromise;
    await set("chordsource", { data, hash });
  }
}

async function getLatestMetadata() {
  const response = await fetch(
    "https://db.chord.source.in.th/latest.json?rev=" + getUnknownRev()
  );
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const metadata = await response.json();
  const { hash } = metadata;
  if (!hash) {
    throw new Error("Missing hash");
  }
  return { hash };
}

export interface ChoreSearch {
  searchText: string;
}

export function ChordSearch(props: ChoreSearch) {
  const chords = useStore($chords);
  const searchText = props.searchText;
  const searchResult = useMemo(() => {
    const fixed = convert("QWERTY", "Kedmanee", searchText);
    const search = (text: string) =>
      fuzzysort.go(text, chords, {
        key: "search",
        limit: 50,
      });
    type SearchResult = ReturnType<typeof search>;
    type SearchResultItem = SearchResult[0];
    const map = new Map<string, SearchResultItem>();
    const doSearch = (text: string) => {
      const result = search(text);
      for (const item of result) {
        const existing = map.get(item.obj.url);
        if (!existing || item.score > existing.score) {
          map.set(item.obj.url, item);
        }
      }
    };
    doSearch(searchText);
    if (fixed !== searchText) {
      console.log(fixed);
      doSearch(fixed);
    }
    return [
      ...Array.from(map.values()).sort((a, b) => b.score - a.score),
      {
        obj: {
          id: "google",
          title: searchText,
          artist: "ค้นหาใน Google",
          url: `https://www.google.com/search?q=${encodeURIComponent(
            searchText
          )}`,
        },
        score: 0,
      },
    ];
  }, [chords, searchText]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  useEffect(() => {
    ensureData();
  }, []);
  useEffect(() => {
    setSelectedIndex(0);
    eventHandlers.onDown = () => {
      if (searchResult.length) {
        setSelectedIndex((i) => (i + 1) % searchResult.length);
      }
    };
    eventHandlers.onUp = () => {
      if (searchResult.length) {
        setSelectedIndex(
          (i) => (i + searchResult.length - 1) % searchResult.length
        );
      }
    };
  }, [searchResult]);

  return (
    <div>
      {!chords.length && <LoadingMessage />}
      {searchText && !searchResult.length ? (
        <>
          <div className="text-center italic opacity-50">
            ไม่พบคอร์ดที่ค้นหา
          </div>
        </>
      ) : searchText ? (
        <ul>
          {searchResult.map((result, i) => {
            return (
              <li
                key={result.obj.url}
                className={
                  "border-t first-of-type:border-t-0 border-slate-700 " +
                  (i === selectedIndex ? "bg-slate-800 text-yellow-300" : "")
                }
                onMouseEnter={() => {
                  setSelectedIndex(i);
                }}
                data-score={result.score}
              >
                <a
                  href={result.obj.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-1 flex gap-2 items-center overflow-hidden"
                  data-selected={i === selectedIndex}
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set("id", `${result.obj.id}`);
                    params.set("link", result.obj.url);
                    params.set("title", result.obj.title);
                    params.set("artist", result.obj.artist);
                    params.set("index", String(i));
                    params.set("query", searchText);
                    params.set(
                      "sid",
                      (sessionStorage.sid ??= crypto.randomUUID().slice(0, 8))
                    );
                    params.set(
                      "lid",
                      (localStorage.lid ??= crypto.randomUUID().slice(0, 8))
                    );
                    params.set("host", location.hostname);
                    navigator.sendBeacon(
                      "https://chordsource.glitch.me/rec",
                      params
                    );
                  }}
                >
                  {result.obj.url.startsWith("https://busk") && (
                    <IconImage image={buskTownIcon} />
                  )}
                  {result.obj.url.startsWith("https://chordtabs") && (
                    <IconImage image={chordtabsIcon} />
                  )}
                  {result.obj.url.startsWith("https://www.dochord") && (
                    <IconImage image={dochordIcon} />
                  )}
                  {result.obj.url.startsWith("https://www.google") && (
                    <IconImage image={"https://www.google.com/favicon.ico"} />
                  )}
                  <span>
                    <strong>{result.obj.title}</strong>
                    {" - "}
                    <cite className="not-italic">{result.obj.artist}</cite>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : chords.length > 0 ? (
        <>
          <div className="text-center italic opacity-50">
            ค้นหาคอร์ดจากทั้งหมด {chords.length} รายการ
          </div>
        </>
      ) : (
        <></>
      )}
    </div>
  );
}

function LoadingMessage() {
  const loadingStatus = useStore($loadingStatus);
  return <Loading text={loadingStatus} />;
}

export default ChordSearch;

const buskTownIcon =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAATsAAAE7AGKbv1yAAACKUlEQVR4nO2XS04CQRCGgQXhJR6ABfEV1ixVPIAK7jTIhsiGhSSaaEI0giSsHbiCREW5gEokURgDDD0cxPcN2uoWCCEzPS3MQEyc5F9NVdfXVV39MJk4PoSQo9FozEiSNMsjYkt8eMZmBG0GEWoVQe8gPKTeEJKuAGadO3C7XV8AJ3GEoCqSarIsz2ulemXEGWsJxkYBxeCkdkD5amDwHoRiJuDHs5pTPB7HHo9HU0tLi7hQONeEaLWk6uDsN1gO4XAYgxmXXC4Xvru75chE38KE1Jf0AiDKZE55SlHsB/jSE0AQBJ4yfHRX/rSW8W8A/H4/bjYbXAsSNix3Z/WzDQXhDEejUaZisR2czWZh0Dp3R5DYJtISY2g9RdF2/Af4EwBkkbndbk15vV4cCgVhNyzoC9BtQ4fDwQTotqLZbIauiOkPkM/nmHa1WhWn06kezP7+3ngBurq+LmKbzYbtdjsul+/HD0AUiUSoz/Hx0WQAcjmB+hBfJgDPVjwMANm+ic/2tjoA3YrJgWAEwNbWJvVJpU5UbURRnKInIhyNn3oCkFuR1WrFTqcTVyoPija94/gHoHWjBwBZ8YeHB3S/IPbJZJJhL131AGRZCvEA8MpiseBEYlcjUwNvBdZbgPdS6vP5aO1LpRtmcMj4k2nw+3lOTfBa3rmeBRB9ThkW/A1mv6wYvA9ijqTIgOCPtO95P4BYg5JcjlIWaLUXGOcCAq9yB1bJimHP828eKmraVAC3ywAAAABJRU5ErkJggg==";
const chordtabsIcon =
  "data:image/png;base64,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";
const dochordIcon =
  "data:image/jpeg;base64,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";

export interface IconImage {
  image: string;
}

export function IconImage(props: IconImage) {
  return (
    <img
      src={props.image}
      className="inline-block w-6 h-6 align-text-bottom rounded"
    />
  );
}
