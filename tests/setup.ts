import { configure } from "@testing-library/dom";

/**
 * The CI runner is slower than a laptop, and `findBy*`/`waitFor` wait one second
 * by default. Two of the root suite's assertions (a track starting, a dialog
 * closing) are React state settling under jsdom, and locally they finish within a
 * few milliseconds of that boundary — which is the shape of a test that fails on a
 * busy machine and passes on a quiet one.
 *
 * Five seconds is not a claim that the app is slow: it is a claim that the test
 * should measure behaviour, not the runner's mood. Everything still fails on a
 * genuine timeout, just later.
 */
configure({ asyncUtilTimeout: 5_000 });
