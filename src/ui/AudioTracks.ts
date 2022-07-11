import track3 from "../assets/audios/track-3.mp3";
import track4 from "../assets/audios/track-4.mp3";
import track5 from "../assets/audios/track-5.mp3";
import track6 from "../assets/audios/track-6.mp3";
import track7 from "../assets/audios/track-7.mp3";
import track8 from "../assets/audios/track-8.mp3";
import track9 from "../assets/audios/track-9.mp3";
import track10 from "../assets/audios/track-10.mp3";
import track11 from "../assets/audios/track-11.mp3";
import track12 from "../assets/audios/track-12.mp3";
import track13 from "../assets/audios/track-13.mp3";
import track14 from "../assets/audios/track-14.mp3";
import track15 from "../assets/audios/track-15.mp3";
import track16 from "../assets/audios/track-16.mp3";
import track17 from "../assets/audios/track-17.mp3";
import track18 from "../assets/audios/track-18.mp3";
import track19 from "../assets/audios/track-19.mp3";
import track20 from "../assets/audios/track-20.mp3";
import track21 from "../assets/audios/track-21.mp3";
import track22 from "../assets/audios/track-22.mp3";
import track23 from "../assets/audios/track-23.mp3";
import track24 from "../assets/audios/track-24.mp3";
import track25 from "../assets/audios/track-25.mp3";

const tracks = [
  track3,
  track4,
  track5,
  track6,
  track7,
  track8,
  track9,
  track10,
  track11,
  track12,
  track13,
  track14,
  track15,
  track16,
  track17,
  track18,
  track19,
  track20,
  track21,
  track22,
  track23,
  track24,
  track25,
  // track26,
];

const tuples = tracks.map((track, i) => {
  return [i + 3, track];
});

export const audioTracks = Object.fromEntries(tuples);

console.log(audioTracks);
