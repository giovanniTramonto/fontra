import chai from "chai";
const expect = chai.expect;

import {
  pointInRect,
  centeredRect,
  normalizeRect,
  sectRect,
  unionRect,
  offsetRect,
  scaleRect,
  insetRect,
  equalRect,
  rectCenter,
  rectSize,
  rectFromArray,
  rectToArray,
  isEmptyRect,
  rectFromPoints,
} from "../src/fontra/client/core/rectangle.js";
import { parametrize } from "./test-support.js";

describe("pointInRect", () => {
  const testData = [
    [
      { x: 0, y: 0 },
      { xMin: -Infinity, yMin: -Infinity, xMax: Infinity, yMax: Infinity },
      true,
      "Rectangle should has not been bound to a limit",
    ],
    [
      { x: 40, y: 40 },
      undefined,
      false,
      "Should return false if rectangle is a falsy value",
    ],
    [{ x: 40, y: 40 }, { xMin: 0, yMin: 0, xMax: 200, yMax: 200 }, true, "Should work"],
    [
      { x: 40.0, y: 40.0 },
      { xMin: 0, yMin: 0, xMax: 200, yMax: 200 },
      true,
      "Should work with floats",
    ],
  ];
  parametrize(
    "is point in rectangle",
    testData,
    ([point, rectangle, acceptance, testDescription]) => {
      const result = pointInRect(point.x, point.y, rectangle);
      expect(result).equals(acceptance, testDescription);
    }
  );
});

describe("centeredRect", () => {
  const testData = [
    [
      { x: 100, y: 100 },
      { width: 50, height: 50 },
      {
        xMin: 75,
        xMax: 125,
        yMin: 75,
        yMax: 125,
      },
      "Should create a rectangle centered to a point",
    ],
    [
      { x: 100, y: 100 },
      { width: 50 },
      {
        xMin: 75,
        xMax: 125,
        yMin: 75,
        yMax: 125,
      },
      "Should create a square if an height is not given",
    ],
  ];
  parametrize(
    "Creates a centered rectagle",
    testData,
    ([point, sizes, acceptance, testDescription]) => {
      const result = centeredRect(point.x, point.y, sizes.width, sizes.height);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("normalizeRect", () => {
  const testData = [
    [
      { xMin: 100, yMin: 100, xMax: 0, yMax: 0 },
      { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
    ],
    [
      { xMin: 100, yMin: 0, xMax: 0, yMax: 100 },
      { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
    ],
    [
      { xMin: 0, yMin: 100, xMax: 100, yMax: 0 },
      { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
    ],
  ];
  parametrize(
    "Normalizes a rectangle",
    testData,
    ([rectangle, acceptance, testDescription]) => {
      const result = normalizeRect(rectangle);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("sectRect", () => {
  const testData = [
    [
      { xMin: 50, yMin: 50, xMax: 100, yMax: 100 },
      { xMin: 75, yMin: 75, xMax: 80, yMax: 80 },
      { xMin: 75, yMin: 75, xMax: 80, yMax: 80 },
    ],
    [
      { xMin: 50, yMin: 50, xMax: 60, yMax: 60 },
      { xMin: 60, yMin: 60, xMax: 70, yMax: 70 },
      { xMin: 60, yMin: 60, xMax: 60, yMax: 60 },
      "Creates rectangle with sizes of 0 if they intersect at the edge", // should be clarified with @justvanrossum
    ],
    [
      { xMin: 50, yMin: 50, xMax: 60, yMax: 60 },
      { xMin: 61, yMin: 61, xMax: 70, yMax: 70 },
      undefined,
      "Should not create a rectangle if they do not intersect",
    ],
  ];
  parametrize(
    "Creates an intersection by given two rectangles",
    testData,
    ([a, b, acceptance, testDescription]) => {
      const result = sectRect(a, b);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("unionRect", () => {
  const testData = [
    [[], undefined],
    [
      [
        { xMin: 50, yMin: 50, xMax: 100, yMax: 100 },
        { xMin: 100, yMin: 75, xMax: 150, yMax: 100 },
      ],
      {
        xMin: 50,
        xMax: 150,
        yMin: 50,
        yMax: 100,
      },
    ],
  ];
  parametrize(
    "Creates a rectangle that is smallest superset of given rectangles",
    testData,
    ([rects, acceptance, testDescription]) => {
      const result = unionRect(...rects);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("offsetRect", () => {
  const testData = [
    [
      { xMin: 50, yMin: 50, xMax: 60, yMax: 60 },
      { x: -10, y: -10 },
      {
        xMin: 40,
        yMin: 40,
        xMax: 50,
        yMax: 50,
      },
    ],
    [
      { xMin: 50, yMin: 50, xMax: 60, yMax: 60 },
      { x: 10, y: 10 },
      {
        xMin: 60,
        yMin: 60,
        xMax: 70,
        yMax: 70,
      },
    ],
  ];
  parametrize(
    "Moves the rectangle by given offset",
    testData,
    ([rectangle, offset, acceptance, testDescription]) => {
      const result = offsetRect(rectangle, offset.x, offset.y);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("scaleRect", () => {
  const testData = [
    [
      { xMin: 50, yMin: 50, xMax: 60, yMax: 60 },
      { x: 2, y: 4 },
      { xMin: 100, yMin: 200, xMax: 120, yMax: 240 },
    ],
    [
      { xMin: 50, yMin: 50, xMax: 60, yMax: 60 },
      { x: 2, y: undefined },
      { xMin: 100, yMin: 100, xMax: 120, yMax: 120 },
    ],
  ];
  parametrize(
    "Scales the given rectangle by multipier",
    testData,
    ([rectangle, scale, acceptance, testDescription]) => {
      const result = scaleRect(rectangle, scale.x, scale.y);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("insetRect", () => {
  const testData = [
    [
      { xMin: 50, yMin: 50, xMax: 60, yMax: 60 },
      { x: 10, y: 10 },
      {
        xMin: 60,
        yMin: 60,
        xMax: 50,
        yMax: 50,
      },
    ],
  ];
  parametrize(
    "Scales down the rectangle from the center by given offset",
    testData,
    ([rectangle, offset, acceptance, testDescription]) => {
      const result = insetRect(rectangle, offset.x, offset.y);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("equalRect", () => {
  const testData = [
    [
      { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
      { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
      true,
    ],
    [
      { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
      { xMin: 0.0, yMin: 0, xMax: 10, yMax: 10 },
      true,
    ],
    [
      { xMin: 1, yMin: 0, xMax: 10, yMax: 10 },
      { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
      false,
    ],
  ];
  parametrize(
    "Checks if the rectangles are in same sizes and positioned equally",
    testData,
    ([a, b, acceptance, testDescription]) => {
      const result = equalRect(a, b);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("rectCenter", () => {
  const testData = [
    [
      { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
      { x: 5, y: 5 },
    ],
    [
      { xMin: -10, yMin: -10, xMax: 10, yMax: 10 },
      { x: 0, y: 0 },
    ],
  ];
  parametrize(
    "Finds the center of given rectangle",
    testData,
    ([rectangle, acceptance, testDescription]) => {
      const result = rectCenter(rectangle);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("rectSize", () => {
  const testData = [
    [
      { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
      { width: 10, height: 10 },
    ],
    [
      { xMin: -10, yMin: -10, xMax: 10, yMax: 10 },
      { width: 20, height: 20 },
    ],
  ];
  parametrize(
    "Returns the size of given rectangle",
    testData,
    ([rectangle, acceptance, testDescription]) => {
      const result = rectSize(rectangle);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("rectFromArray", () => {
  const testData = [
    [[0, 0, 10, 10], { xMin: 0, yMin: 0, xMax: 10, yMax: 10 }],
    [
      [],
      (rectangle) => {
        expect(() => {
          rectFromArray(rectangle);
        }).to.throw();
      },
    ],
  ];
  parametrize(
    "Creates rectangle from an array",
    testData,
    ([rectangle, acceptance, testDescription]) => {
      if (typeof acceptance === "function") {
        acceptance(rectangle);
      } else {
        const result = rectFromArray(rectangle);
        expect(result).deep.equals(acceptance, testDescription);
      }
    }
  );
});

describe("rectToArray", () => {
  const testData = [[{ xMin: 0, yMin: 0, xMax: 10, yMax: 10 }, [0, 0, 10, 10]]];
  parametrize(
    "Creates array from given rectangle",
    testData,
    ([rectangle, acceptance, testDescription]) => {
      const result = rectToArray(rectangle);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("isEmptyRect", () => {
  const testData = [
    [{ xMin: 10, yMin: 10, xMax: 10, yMax: 10 }, true],
    [{ xMin: 10, yMin: 10, xMax: 10, yMax: 11 }, false],
  ];
  parametrize(
    "Checks if the area of given rectangle is zero",
    testData,
    ([rectangle, acceptance, testDescription]) => {
      const result = isEmptyRect(rectangle);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});

describe("rectFromPoints", () => {
  const testData = [
    [[], undefined],
    [
      [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
      ],
      {
        xMin: 0,
        yMin: 0,
        xMax: 10,
        yMax: 10,
      },
    ],
    [
      [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
        { x: -20, y: 10 },
      ],
      {
        xMin: -20,
        yMin: 0,
        xMax: 10,
        yMax: 10,
      },
    ],
  ];
  parametrize(
    "Creates a rectangle from given points",
    testData,
    ([rectangle, acceptance, testDescription]) => {
      const result = rectFromPoints(rectangle);
      expect(result).deep.equals(acceptance, testDescription);
    }
  );
});
