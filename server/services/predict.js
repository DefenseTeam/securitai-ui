import * as KerasJS from 'keras-js';
import _ from 'lodash';
import { storePrediction } from './localStore';

const config = process.env.PROD ? require('../config/prod') : require('../config/dev');

const wordDict = require(config.wordDict);
const model = new KerasJS.Model({
  filepaths: {
    model: config.model,
    weights: config.weights,
    metadata: config.metadata
  },
  filesystem: true
});

export function predictMaliciousRequest(requestLog) {
  const parsedLog = JSON.parse(requestLog);
  model.ready()
    .then(() => {
      const maxInputLength = 1024;
      let logToSequence = [];
      let paddedSequence = new Float32Array(maxInputLength).fill(0);

      // Choosing log properties we are interested in to process
      const processedLog = JSON.stringify(_.pick(parsedLog, ['method','query','path','statusCode','requestPayload']), null, 0);
      for (let i = 0; i < processedLog.length; i++) {
        const key = processedLog[i];
        if (wordDict[key]) {
          logToSequence.push(wordDict[key]);
        }
      };

      // Fit log sequence to paddedSequence
      for (let i = logToSequence.length; i > -1; i--) {
        const revPos = paddedSequence.length - (logToSequence.length - i);
        paddedSequence[revPos] = logToSequence[i];
      }

      return model.predict({
        'input': paddedSequence
      });
    })
    .then(prediction => {
      if (_.size(prediction.output) > 0) {
        console.log(`Malicious request confidence: ${(prediction.output[0] * 100).toFixed(2)}%`);
        storePrediction(parsedLog, prediction.output[0]);
      }
    })
    .catch(err => {
      console.log(err);
    })
}
