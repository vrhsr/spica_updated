'use server';
import {genkit, configureGenkit} from 'genkit';

configureGenkit({
  enableTracingAndMetrics: true,
});

export const ai = genkit();
