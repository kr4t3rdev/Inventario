import React from "react";

const Loader3 = () => {
	return (
		<>
			<style>{`
        .rojo-loader-wrap #ghost {
          position: relative;
          scale: 0.8;
        }
        .rojo-loader-wrap #red {
          animation: rojo-upNDown infinite 0.5s;
          position: relative;
          width: 140px;
          height: 140px;
          display: grid;
          grid-template-columns: repeat(14, 1fr);
          grid-template-rows: repeat(14, 1fr);
          grid-column-gap: 0px;
          grid-row-gap: 0px;
          grid-template-areas:
            "a1  a2  a3  a4  a5  top0  top0  top0  top0  a10 a11 a12 a13 a14"
            "b1  b2  b3  top1 top1 top1 top1 top1 top1 top1 top1 b12 b13 b14"
            "c1 c2 top2 top2 top2 top2 top2 top2 top2 top2 top2 top2 c13 c14"
            "d1 top3 top3 top3 top3 top3 top3 top3 top3 top3 top3 top3 top3 d14"
            "e1 top3 top3 top3 top3 top3 top3 top3 top3 top3 top3 top3 top3 e14"
            "f1 top3 top3 top3 top3 top3 top3 top3 top3 top3 top3 top3 top3 f14"
            "top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4"
            "top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4"
            "top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4"
            "top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4"
            "top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4"
            "top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4 top4"
            "st0 st0 an4 st1 an7 st2 an10 an10 st3 an13 st4 an16 st5 st5"
            "an1 an2 an3 an5 an6 an8 an9 an9 an11 an12 an14 an15 an17 an18";
        }
        @keyframes rojo-upNDown {
          0%, 49% { transform: translateY(0px); }
          50%, 100% { transform: translateY(-10px); }
        }
        .rojo-loader-wrap #top0,
        .rojo-loader-wrap #top1,
        .rojo-loader-wrap #top2,
        .rojo-loader-wrap #top3,
        .rojo-loader-wrap #top4,
        .rojo-loader-wrap #st0,
        .rojo-loader-wrap #st1,
        .rojo-loader-wrap #st2,
        .rojo-loader-wrap #st3,
        .rojo-loader-wrap #st4,
        .rojo-loader-wrap #st5 {
          background-color: red;
        }
        .rojo-loader-wrap #top0 { grid-area: top0; }
        .rojo-loader-wrap #top1 { grid-area: top1; }
        .rojo-loader-wrap #top2 { grid-area: top2; }
        .rojo-loader-wrap #top3 { grid-area: top3; }
        .rojo-loader-wrap #top4 { grid-area: top4; }
        .rojo-loader-wrap #st0 { grid-area: st0; }
        .rojo-loader-wrap #st1 { grid-area: st1; }
        .rojo-loader-wrap #st2 { grid-area: st2; }
        .rojo-loader-wrap #st3 { grid-area: st3; }
        .rojo-loader-wrap #st4 { grid-area: st4; }
        .rojo-loader-wrap #st5 { grid-area: st5; }
        .rojo-loader-wrap #an1 { grid-area: an1; animation: rojo-flicker0 infinite 0.5s; }
        .rojo-loader-wrap #an18 { grid-area: an18; animation: rojo-flicker0 infinite 0.5s; }
        .rojo-loader-wrap #an2 { grid-area: an2; animation: rojo-flicker1 infinite 0.5s; }
        .rojo-loader-wrap #an17 { grid-area: an17; animation: rojo-flicker1 infinite 0.5s; }
        .rojo-loader-wrap #an3 { grid-area: an3; animation: rojo-flicker1 infinite 0.5s; }
        .rojo-loader-wrap #an16 { grid-area: an16; animation: rojo-flicker1 infinite 0.5s; }
        .rojo-loader-wrap #an4 { grid-area: an4; animation: rojo-flicker1 infinite 0.5s; }
        .rojo-loader-wrap #an15 { grid-area: an15; animation: rojo-flicker1 infinite 0.5s; }
        .rojo-loader-wrap #an6 { grid-area: an6; animation: rojo-flicker0 infinite 0.5s; }
        .rojo-loader-wrap #an12 { grid-area: an12; animation: rojo-flicker0 infinite 0.5s; }
        .rojo-loader-wrap #an7 { grid-area: an7; animation: rojo-flicker0 infinite 0.5s; }
        .rojo-loader-wrap #an13 { grid-area: an13; animation: rojo-flicker0 infinite 0.5s; }
        .rojo-loader-wrap #an9 { grid-area: an9; animation: rojo-flicker1 infinite 0.5s; }
        .rojo-loader-wrap #an10 { grid-area: an10; animation: rojo-flicker1 infinite 0.5s; }
        .rojo-loader-wrap #an8 { grid-area: an8; animation: rojo-flicker0 infinite 0.5s; }
        .rojo-loader-wrap #an11 { grid-area: an11; animation: rojo-flicker0 infinite 0.5s; }
        @keyframes rojo-flicker0 {
          0%, 49% { background-color: red; }
          50%, 100% { background-color: transparent; }
        }
        @keyframes rojo-flicker1 {
          0%, 49% { background-color: transparent; }
          50%, 100% { background-color: red; }
        }
        .rojo-loader-wrap #eye {
          width: 40px; height: 50px;
          position: absolute; top: 30px; left: 10px;
        }
        .rojo-loader-wrap #eye::before {
          content: "";
          background-color: white;
          width: 20px; height: 50px;
          transform: translateX(10px);
          display: block; position: absolute;
        }
        .rojo-loader-wrap #eye::after {
          content: "";
          background-color: white;
          width: 40px; height: 30px;
          transform: translateY(10px);
          display: block; position: absolute;
        }
        .rojo-loader-wrap #eye1 {
          width: 40px; height: 50px;
          position: absolute; top: 30px; right: 30px;
        }
        .rojo-loader-wrap #eye1::before {
          content: "";
          background-color: white;
          width: 20px; height: 50px;
          transform: translateX(10px);
          display: block; position: absolute;
        }
        .rojo-loader-wrap #eye1::after {
          content: "";
          background-color: white;
          width: 40px; height: 30px;
          transform: translateY(10px);
          display: block; position: absolute;
        }
        .rojo-loader-wrap #pupil {
          width: 20px; height: 20px;
          background-color: blue;
          position: absolute; top: 50px; left: 10px;
          z-index: 1;
          animation: rojo-eyesMovement infinite 3s;
        }
        .rojo-loader-wrap #pupil1 {
          width: 20px; height: 20px;
          background-color: blue;
          position: absolute; top: 50px; right: 50px;
          z-index: 1;
          animation: rojo-eyesMovement infinite 3s;
        }
        @keyframes rojo-eyesMovement {
          0%, 49% { transform: translateX(0px); }
          50%, 99% { transform: translateX(10px); }
          100% { transform: translateX(0px); }
        }
        .rojo-loader-wrap #shadow {
          background-color: black;
          width: 140px; height: 140px;
          position: absolute;
          border-radius: 50%;
          transform: rotateX(80deg);
          filter: blur(20px);
          top: 80%;
          animation: rojo-shadowMovement infinite 0.5s;
        }
        @keyframes rojo-shadowMovement {
          0%, 49% { opacity: 0.5; }
          50%, 100% { opacity: 0.2; }
        }
      `}</style>
			<div className="rojo-loader-wrap">
				<div id="ghost">
					<div id="red">
						<div id="pupil" />
						<div id="pupil1" />
						<div id="eye" />
						<div id="eye1" />
						<div id="top0" />
						<div id="top1" />
						<div id="top2" />
						<div id="top3" />
						<div id="top4" />
						<div id="st0" />
						<div id="st1" />
						<div id="st2" />
						<div id="st3" />
						<div id="st4" />
						<div id="st5" />
						<div id="an1" />
						<div id="an2" />
						<div id="an3" />
						<div id="an4" />
						<div id="an5" />
						<div id="an6" />
						<div id="an7" />
						<div id="an8" />
						<div id="an9" />
						<div id="an10" />
						<div id="an11" />
						<div id="an12" />
						<div id="an13" />
						<div id="an14" />
						<div id="an15" />
						<div id="an16" />
						<div id="an17" />
						<div id="an18" />
					</div>
					<div id="shadow" />
				</div>
			</div>
		</>
	);
};

export default Loader3;
