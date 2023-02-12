import chai from "chai";
const expect = chai.expect;

import { PathHitTester } from "../src/fontra/client/core/path-hit-tester.js";
import { VarPackedPath } from "../src/fontra/client/core/var-path.js";

describe("PathHitTester Tests", () => {
  const hitTest_testData = [
    [{ x: -30, y: 10 }, 20, {}],
    [
      { x: 10, y: 10 },
      20,
      { contourIndex: 0, segmentIndex: 0, d: 10, t: 0.1, x: 0, y: 10 },
    ],
    [
      { x: 100, y: 10 },
      20,
      { contourIndex: 0, segmentIndex: 3, d: 10, t: 0.5, x: 100, y: 0 },
    ],
    [
      { x: 190, y: 10 },
      20,
      { contourIndex: 0, segmentIndex: 2, d: 14.142135623730951, t: 1, x: 200, y: 0 },
    ],
    [{ x: 190, y: 49 }, 20, {}],
    [
      { x: 230, y: 49 },
      20,
      {
        contourIndex: 0,
        segmentIndex: 2,
        d: 5.009098283124404,
        t: 0.509,
        x: 224.99190000000002,
        y: 49.1,
      },
    ],
  ];
  for (let i = 0; i < hitTest_testData.length; i++) {
    const [testPoint, margin, expectedHit] = hitTest_testData[i];
    it(`hitTest test ${i}`, () => {
      const p = new VarPackedPath();
      p.moveTo(0, 0);
      p.lineTo(0, 100);
      p.lineTo(200, 100);
      p.quadraticCurveTo(250, 50, 200, 0);
      p.closePath();
      const pcf = new PathHitTester(p);
      const hit = pcf.hitTest(testPoint, margin);
      expect(hit).to.deep.equal(expectedHit);
    });
  }
});