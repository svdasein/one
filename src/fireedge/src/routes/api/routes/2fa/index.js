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

const { Map } = require('immutable');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { getConfig } = require('../../../../utils/yml');
const {
  httpMethod,
  defaultMethodUserInfo,
  defaultMethodUserUpdate,
  default2FAIssuer,
  default2FAOpennebulaVar,
  default2FAOpennebulaTmpVar
} = require('../../../../utils/contants/defaults');
const {
  ok,
  unauthorized,
  internalServerError
} = require('../../../../utils/contants/http-codes');
const { from: fromData } = require('../../../../utils/contants/defaults');
const {
  responseOpennebula,
  checkOpennebulaCommand,
  generateNewTemplate
} = require('../../../../utils/opennebula');

// user config
const appConfig = getConfig();

const twoFactorAuthIssuer =
  appConfig.TWO_FACTOR_AUTH_ISSUER || default2FAIssuer;

const { POST, GET, DELETE } = httpMethod;

const getUserInfoAuthenticated = (connect, userId, callback, next) => {
  if (
    connect &&
    !!userId &&
    callback &&
    next &&
    typeof connect === 'function' &&
    typeof callback === 'function' &&
    typeof next === 'function' &&
    defaultMethodUserInfo
  ) {
    const connectOpennebula = connect();
    const dataUser = {};
    // empty positions for validate...
    dataUser[fromData.resource] = {};
    dataUser[fromData.query] = {};
    dataUser[fromData.postBody] = {};
    dataUser[fromData.resource].id = userId;
    const getOpennebulaMethod = checkOpennebulaCommand(
      defaultMethodUserInfo,
      GET
    );
    connectOpennebula(
      defaultMethodUserInfo,
      getOpennebulaMethod(dataUser),
      (err, value) => {
        responseOpennebula(
          () => undefined,
          err,
          value,
          info => {
            if (info !== undefined && info !== null) {
              callback(info);
            } else {
              next();
            }
          },
          next
        );
      }
    );
  }
};

const privateRoutes = {
  '2fqr': {
    httpMethod: POST,
    action: (req, res, next, connect, userId) => {
      const secret = speakeasy.generateSecret({
        length: 10,
        name: twoFactorAuthIssuer
      });
      if (secret && secret.otpauth_url && secret.base32) {
        const { otpauth_url: otpURL, base32 } = secret;
        qrcode.toDataURL(otpURL, (err, dataURL) => {
          if (err) {
            res.locals.httpCode = Map(internalServerError).toObject();
            next();
          } else {
            const connectOpennebula = connect();
            getUserInfoAuthenticated(
              connect,
              userId,
              info => {
                if (info && info.USER && info.USER.TEMPLATE && req) {
                  const dataUser = Map(req).toObject();
                  const emptyTemplate = {};
                  emptyTemplate[default2FAOpennebulaTmpVar] = base32;

                  dataUser[fromData.resource].id = userId;
                  dataUser[fromData.postBody].template = generateNewTemplate(
                    info.USER.TEMPLATE.SUNSTONE || {},
                    emptyTemplate,
                    [default2FAOpennebulaVar]
                  );
                  const getOpennebulaMethod = checkOpennebulaCommand(
                    defaultMethodUserUpdate,
                    POST
                  );
                  connectOpennebula(
                    defaultMethodUserUpdate,
                    getOpennebulaMethod(dataUser),
                    (error, value) => {
                      responseOpennebula(
                        () => undefined,
                        error,
                        value,
                        pass => {
                          if (pass !== undefined && pass !== null) {
                            const codeOK = Map(ok).toObject();
                            codeOK.data = {
                              img: dataURL
                            };
                            res.locals.httpCode = codeOK;
                            next();
                          } else {
                            next();
                          }
                        },
                        next
                      );
                    }
                  );
                } else {
                  next();
                }
              },
              next
            );
          }
        });
      } else {
        next();
      }
    }
  },
  '2fsetup': {
    httpMethod: POST,
    action: (req, res, next, connect, userId) => {
      const connectOpennebula = connect();
      getUserInfoAuthenticated(
        connect,
        userId,
        info => {
          if (
            info &&
            info.USER &&
            info.USER.TEMPLATE &&
            info.USER.TEMPLATE.SUNSTONE &&
            info.USER.TEMPLATE.SUNSTONE[default2FAOpennebulaTmpVar] &&
            fromData &&
            fromData.postBody &&
            req &&
            req[fromData.postBody] &&
            req[fromData.postBody].token
          ) {
            const sunstone = info.USER.TEMPLATE.SUNSTONE;
            const token = req[fromData.postBody].token;
            const secret = sunstone[default2FAOpennebulaTmpVar];
            const verified = speakeasy.totp.verify({
              secret,
              encoding: 'base32',
              token
            });
            if (verified) {
              const emptyTemplate = {};
              emptyTemplate[default2FAOpennebulaVar] = secret;

              const dataUser = Map(req).toObject();
              dataUser[fromData.resource].id = userId;
              dataUser[fromData.postBody].template = generateNewTemplate(
                sunstone || {},
                emptyTemplate,
                [default2FAOpennebulaTmpVar]
              );
              const getOpennebulaMethodUpdate = checkOpennebulaCommand(
                defaultMethodUserUpdate,
                POST
              );
              connectOpennebula(
                defaultMethodUserUpdate,
                getOpennebulaMethodUpdate(dataUser),
                (err, value) => {
                  responseOpennebula(
                    () => undefined,
                    err,
                    value,
                    pass => {
                      if (pass !== undefined && pass !== null) {
                        const codeOK = Map(ok).toObject();
                        res.locals.httpCode = codeOK;
                      }
                      next();
                    },
                    next
                  );
                }
              );
            } else {
              res.locals.httpCode = Map(unauthorized).toObject();
              next();
            }
          } else {
            next();
          }
        },
        next
      );
    }
  },
  '2fdelete': {
    httpMethod: DELETE,
    action: (req, res, next, connect, userId) => {
      const connectOpennebula = connect();
      getUserInfoAuthenticated(
        connect,
        userId,
        info => {
          if (
            info &&
            info.USER &&
            info.USER.TEMPLATE &&
            info.USER.TEMPLATE.SUNSTONE
          ) {
            const emptyTemplate = {};
            const dataUser = Map(req).toObject();
            dataUser[fromData.resource].id = userId;
            dataUser[fromData.postBody].template = generateNewTemplate(
              info.USER.TEMPLATE.SUNSTONE || {},
              emptyTemplate,
              [default2FAOpennebulaTmpVar, default2FAOpennebulaVar]
            );
            const getOpennebulaMethodUpdate = checkOpennebulaCommand(
              defaultMethodUserUpdate,
              POST
            );
            connectOpennebula(
              defaultMethodUserUpdate,
              getOpennebulaMethodUpdate(dataUser),
              (err, value) => {
                responseOpennebula(
                  () => undefined,
                  err,
                  value,
                  pass => {
                    if (pass !== undefined && pass !== null) {
                      const codeOK = Map(ok).toObject();
                      res.locals.httpCode = codeOK;
                    }
                    next();
                  },
                  next
                );
              }
            );
          } else {
            next();
          }
        },
        next
      );
    }
  }
};

const publicRoutes = {};

const functionRoutes = {
  private: privateRoutes,
  public: publicRoutes
};

module.exports = functionRoutes;
