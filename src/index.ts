import { MaskRevealView } from "./ui/ThreeView";
declare class DocumentTouch {}
class Main {
  public WEBP_SUPPORTED = false;
  public PREMULTIPLIEDALPHA = true;
  // @ts-ignore
  private maskRevealView: MaskRevealView;
  private refCalcHeightDiv = document.getElementById(
    "CALC_HEIGHT_DIV"
  ) as HTMLDivElement;
  public I_OS: boolean =
    (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  public IS_TOUCH_DEVICE: boolean =
    "ontouchstart" in window ||
    ((window as any).DocumentTouch && document instanceof DocumentTouch); // https://github.com/Modernizr/Modernizr/blob/master/feature-detects/touchevents.js
  public IS_ANDROID = navigator.userAgent.toLowerCase().indexOf("android") > -1; //&& ua.indexOf("mobile");
  constructor() {
    this.supportsWebp((supported: boolean) => {
      this.WEBP_SUPPORTED = supported;
      this.PREMULTIPLIEDALPHA =
        this.I_OS || this.IS_ANDROID || this.WEBP_SUPPORTED ? false : false;
      console.log("webp support", supported);
      console.log("ios: ", this.I_OS);
      console.log("IS_TOUCH_DEVICE: ", this.IS_TOUCH_DEVICE);
      this.maskRevealView = new MaskRevealView(
        document.querySelector("#canvasContainer") as HTMLElement
      );
      this.resize();
      window.addEventListener("resize", this.resize);
    });
  }

  supportsWebp(cb: Function) {
    var image = new Image();
    image.onerror = () => cb(false);
    image.onload = (e) => cb(e && e.type === "load" && image.width === 1);
    image.src =
      "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
  }

  resize = () => {
    document.documentElement.style.setProperty(
      "--window-height",
      `${window.innerHeight}px`
    );
    document.documentElement.style.setProperty(
      `--window-ui-offset`,
      this.refCalcHeightDiv.clientHeight - window.innerHeight + "px"
    );
  };
}

window.onload = () => {
  // @ts-ignore
  window.Main = new Main();

  const showCopyBanner = (err?: any) => {
    const banner = document.getElementById("copy-banner");
    if (banner !== null) {
      banner.classList.add("visible");
      if (err !== undefined) {
        banner.innerText = "Error al copiar el link";
      } else {
        banner.innerText = "Link copiado";
      }
      setTimeout(() => {
        banner.classList.remove("visible");
      }, 3000);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText("https://guau.ar/eureka/leer")
      .then(() => {
        showCopyBanner();
      })
      .catch((err) => {
        showCopyBanner(err);
        console.log("Oops, unable to copy", err);
      });
  };

  const copyLinkBtn = document.getElementById("copy-link-btn");
  if (copyLinkBtn !== null) {
    copyLinkBtn.onclick = copyToClipboard;
  }
};
