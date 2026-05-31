import React from "react";

const Loader2 = () => {
	return (
		<>
			<style>{`
        .hoja-loader-wrap .loader {
          --path: #2f3545;
          --dot: #5628ee;
          --duration: 3s;
          width: 44px;
          height: 44px;
          position: relative;
          display: inline-block;
          margin: 0 16px;
        }
        .hoja-loader-wrap .loader:before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          position: absolute;
          display: block;
          background: var(--dot);
          top: 37px;
          left: 19px;
          transform: translate(-18px, -18px);
          animation: hoja-dotRect var(--duration) cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }
        .hoja-loader-wrap .loader svg {
          display: block;
          width: 100%;
          height: 100%;
        }
        .hoja-loader-wrap .loader svg rect,
        .hoja-loader-wrap .loader svg polygon,
        .hoja-loader-wrap .loader svg circle {
          fill: none;
          stroke: var(--path);
          stroke-width: 10px;
          stroke-linejoin: round;
          stroke-linecap: round;
        }
        .hoja-loader-wrap .loader svg polygon {
          stroke-dasharray: 145 76 145 76;
          stroke-dashoffset: 0;
          animation: hoja-pathTriangle var(--duration) cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }
        .hoja-loader-wrap .loader svg rect {
          stroke-dasharray: 192 64 192 64;
          stroke-dashoffset: 0;
          animation: hoja-pathRect 3s cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }
        .hoja-loader-wrap .loader svg circle {
          stroke-dasharray: 150 50 150 50;
          stroke-dashoffset: 75;
          animation: hoja-pathCircle var(--duration) cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }
        .hoja-loader-wrap .loader.triangle {
          width: 48px;
        }
        .hoja-loader-wrap .loader.triangle:before {
          left: 21px;
          transform: translate(-10px, -18px);
          animation: hoja-dotTriangle var(--duration) cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }
        @keyframes hoja-pathTriangle {
          33% { stroke-dashoffset: 74; }
          66% { stroke-dashoffset: 147; }
          100% { stroke-dashoffset: 221; }
        }
        @keyframes hoja-dotTriangle {
          33% { transform: translate(0, 0); }
          66% { transform: translate(10px, -18px); }
          100% { transform: translate(-10px, -18px); }
        }
        @keyframes hoja-pathRect {
          25% { stroke-dashoffset: 64; }
          50% { stroke-dashoffset: 128; }
          75% { stroke-dashoffset: 192; }
          100% { stroke-dashoffset: 256; }
        }
        @keyframes hoja-dotRect {
          25% { transform: translate(0, 0); }
          50% { transform: translate(18px, -18px); }
          75% { transform: translate(0, -36px); }
          100% { transform: translate(-18px, -18px); }
        }
        @keyframes hoja-pathCircle {
          25% { stroke-dashoffset: 125; }
          50% { stroke-dashoffset: 175; }
          75% { stroke-dashoffset: 225; }
          100% { stroke-dashoffset: 275; }
        }
      `}</style>
			<div className="hoja-loader-wrap">
				<div>
					<div className="loader">
						<svg viewBox="0 0 80 80">
							<circle r={32} cy={40} cx={40} id="test" />
						</svg>
					</div>
					<div className="loader triangle">
						<svg viewBox="0 0 86 80">
							<polygon points="43 8 79 72 7 72" />
						</svg>
					</div>
					<div className="loader">
						<svg viewBox="0 0 80 80">
							<rect height={64} width={64} y={8} x={8} />
						</svg>
					</div>
				</div>
			</div>
		</>
	);
};

export default Loader2;
