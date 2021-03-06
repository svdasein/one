/* Copyright 2002-2019, OpenNebula Project, OpenNebula Systems                */
/*                                                                            */
/* Licensed under the Apache License, Version 2.0 (the "License"); you may    */
/* not use this file except in compliance with the License. You may obtain    */
/* a copy of the License at                                                   */
/*                                                                            */
/* http://www.apache.org/licenses/LICENSE-2.0                                 */
/*                                                                            */
/* Unless required by applicable law or agreed to in writing, software        */
/* distributed under the License is distributed on an "AS IS" BASIS,          */
/* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   */
/* See the License for the specific language governing permissions and        */
/* limitations under the License.                                             */
/* -------------------------------------------------------------------------- */

const fs = require('fs-extra');
const YAML = require('yaml');
const { defaultConfigFile } = require('./contants/defaults');

const getConfig = () => {
  let rtn = {};
  if (
    defaultConfigFile &&
    fs &&
    fs.readFileSync &&
    fs.existsSync &&
    fs.existsSync(defaultConfigFile)
  ) {
    const file = fs.readFileSync(defaultConfigFile, 'utf8');
    rtn = YAML.parse(file);
  }
  return rtn;
};

module.exports = {
  getConfig
};
