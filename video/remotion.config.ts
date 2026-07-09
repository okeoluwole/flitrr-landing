import { Config } from '@remotion/cli/config';

// JPEG frames render faster and are plenty for H.264 delivery.
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// The container ships a Chromium at /opt/pw-browsers; point Remotion at it so
// it never needs to download its own Chrome Headless Shell through the proxy.
// Comment this out to let Remotion manage its own browser locally.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
