export interface Loading {
  text?: string;
}

export function Loading(props: Loading) {
  return (
    <>
      <div className="text-center italic opacity-70">
        {props.text || "Loading..."}
      </div>
    </>
  );
}
