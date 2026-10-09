import { Composition } from "remotion";
import { NooniClip, NOONI_DURATION } from "./nooni/NooniClip";

export const Root: React.FC = () => (
  <>
    <Composition
      id="nooni"
      component={NooniClip}
      durationInFrames={NOONI_DURATION}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
