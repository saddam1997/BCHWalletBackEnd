/**
 * UserController
 *
 * @description :: Server-side logic for managing users
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var bitcoinBTC = require('bitcoin');
var bitcoinBCH = require('bitcoin');
var bcrypt = require('bcrypt');
var clientBTC = new bitcoinBTC.Client({
  host: 'localhost',
  port: 8332,
  user: 'test',
  pass: 'test',
  timeout: 30000
});

var clientBCH = new bitcoinBCH.Client({
  host: 'localhost',
  port: 8332,
  user: 'test',
  pass: 'test',
  timeout: 30000
});
module.exports = {

  createNewUser: function(req, res) {
    console.log(req.body.email + " Creating new address ..................... " + JSON.stringify(req.body));
    if (!req.body.password || !req.body.confirmPassword || !req.body.email|| !req.body.spendingpassword) {
      return res.json(500, {
        err: 'user details required!'
      });
    }
    if (req.body.password !== req.body.confirmPassword) {
      return res.json(401, {
        err: 'Password doesn\'t match, What a shame!'
      });
    }
    User.findOne({
      email: req.body.email
    }, function(err, user) {
      if (err) {
        return res.json(401, {
          err: err
        });
      }
      if (user) {
        console.log("Use email exit and return ");
        return res.json(500, {
          err: 'email already exit'
        });
      }
      if (!user) {
        clientBTC.cmd('getnewaddress', req.body.email, function(err, BTCAddress, resHeaders) {
          if (err) return console.log(err);
          console.log('BTCAddress:', BTCAddress);
          clientBCH.cmd('getnewaddress', req.body.email, function(err, BCHAddress, resHeaders) {
            if (err) return console.log(err);
            console.log('BCHAddress:', BCHAddress);
            bcrypt.hash(req.body.spendingpassword, 10, function(err, hash) {
              if (err) return res.json(500, {
                error: err
              });
              var userObj = {
                email: req.param('email'),
                password: req.param('password'),
                encryptedSpendingpassword: hash,
                userBTCAddress: BTCAddress,
                userBCHAddress: BCHAddress
              }
              User.create(userObj, function userCreated(err, user) {
                if (err) {
                  console.log("User Create err..............");
                  console.log(err);
                  return res.json(err);
                }
                User.publishCreate(user);
                console.log("User Create Succesfully..1....");
                return res.json(200, {
                  user: user,
                  token: jwToken.issue({
                    id: user.id
                  })
                });
              });
            });

          });
        });
      }
    });
  },
  sendAmountToAddressApi: function(req, res, next) {
    console.log("sendToAddressApi called.........");
    var client = new bitcoin.Client({
      host: 'localhost',
      port: 8332,
      user: 'test',
      pass: 'test',
      timeout: 30000
    });
    var batch = [];
    for (var i = 0; i < 1; ++i) {
      batch.push({
        method: 'sendtoaddress',
        params: [req.param('recieverAddress'),
          req.param('amount'),
          req.param('commentForSender'),
          req.param('commentForReciever')
        ]
      });
    }
    client.cmd(batch, function(err, transactionDetails, resHeaders) {
      if (err) return res.serverError(err);

      console.log("transactionDetails::: " + transactionDetails);

    });
  },
  sendAmountToUser: function(req, res, next) {
    console.log("Enter into sendAmountToUser with ::: " + JSON.stringify(req.body));
    if (parseInt(req.body.amount) <= 0) {
      return res.json(200, {
        "message": "Amount not less then zero"
      });
    }
    User.findOne({
      email: req.body.fromUserId
    }).exec(function(err, fromUserDetails) {
      if (err) {
        return res.serverError(err);
      }
      if (parseInt(req.body.amount) > parseInt(fromUserDetails.BTCbalance)) {
        return res.json(200, {
          "message": "Amount Exceed"
        });
      }
      console.log("FromUserDetails::: " + JSON.stringify(fromUserDetails));
      User.findOne({
        email: req.body.toUserId
      }).exec(function(err1, toUserDetails) {
        if (err) {
          return res.serverError(err1);
        }

        var senderUpdatedBalance = fromUserDetails.BTCbalance - parseInt(req.body.amount);
        var recieverUpdatedBalance = toUserDetails.BTCbalance + parseInt(req.body.amount);
        User.update({
            email: req.body.fromUserId
          }, {
            BTCbalance: senderUpdatedBalance
          })
          .exec(function(err, updatedSendUser) {
            if (err) {
              return res.serverError(err);
            }
            User.update({
                email: req.body.toUserId
              }, {
                BTCbalance: recieverUpdatedBalance
              })
              .exec(function(err, updatedRecieveUser) {
                if (err) {
                  return res.serverError(err);
                }
                return res.json({
                  "updatedSendUser": updatedSendUser,
                  "updatedRecieveUser": updatedRecieveUser
                });
              });
          });

      });

    });
  },
//Parameter {userMailId,amount,spendingPassword}
//method{
//   deduct from BTCbalance
//   add in BCHBalance
// }

  buyBCHCoinByUser: function(req, res, next) {
    console.log(parseFloat((22/7).toFixed(8)) +" Enter into buyBCHCoinByUser with ::: " + JSON.stringify(req.body));
    if (parseInt(req.body.amount) <= 0) {
      return res.json(200, {
        "message": "Amount not less then zero"
      });
    }
    User.findOne({
      email: req.body.userMailId
    })
    .exec(function(err, userDetails) {
      if (err) {
        return res.serverError(err);
      }
      if (parseInt(req.body.amount) > parseInt(userDetails.BTCbalance)) {
        return res.json(200, {
          "message": "Amount Exceed"
        });
      }
      User.compareSpendingpassword(req.body.spendingPassword, userDetails, function(err, valid) {
        if (err) {
          console.log("inside.comparePassword.. findOne.authenticated called.........");
          return res.json(403, {
            err: 'forbidden'
          });
        }
        if (!valid) {
          return res.json(401, {
            err: 'invalid  spendingpassword'
          });
        } else {

            console.log("User spendingpassword is valid..............."+parseFloat((22/7).toFixed(8)));
            //msCPbFdzHqdtsdKrwSvzech74hruZteGji company BTC address
            //req.body.amount Amount to send to user
            //req.body.commentForSender
            //req.body.commentForReciever
            clientBTC.cmd(
               'sendfrom',
               req.body.userMailId,
               "msCPbFdzHqdtsdKrwSvzech74hruZteGji",
               req.body.amount,
               3,
               req.body.commentForReciever,
               req.body.commentForSender,
              function(err, TransactionDetails , resHeaders) {
                if (err) return console.log(err);

                console.log('TransactionDetails :', TransactionDetails);
                // return res.json(200, {
                //     "TransactionDetails": TransactionDetails
                //   });

                //"ms6Vmok2vgbyuCGZoawXk9GA3hzshZs7MG", company bch account pennybch@gmail.com

                clientBCH.cmd(
                   'sendfrom',
                   "pennybch@gmail.com",
                   userDetails.userBCHAddress,
                   req.body.amount,
                   3,
                   req.body.commentForReciever,
                   req.body.commentForSender,
                  function(err, TransactionDetails , resHeaders) {
                    if (err) return console.log(err);

                    console.log('TransactionDetails :', TransactionDetails);
                    // return res.json(200, {
                    //     "TransactionDetails": TransactionDetails
                    //   });
                    var updatedBTCbalance = userDetails.BTCbalance - parseInt(req.body.amount);
                    var updatedBCHbalance = userDetails.BCHbalance + parseInt(req.body.amount);
                    User.update({
                        email: req.body.userMailId
                      }, {
                        BTCbalance: updatedBTCbalance,
                        BCHbalance: updatedBCHbalance
                      })
                      .exec(function(err, updatedUser) {
                        if (err) {
                          return res.serverError(err);
                        }
                        //Call RPC ......

                        return res.json({
                          "updatedUser": updatedUser
                        });
                      });
                  });
              });

        }
      });

    });

  },
  sellBCHCoinByUser: function(req, res, next) {

    console.log("Enter into sellBCHCoinByUser with ::: " + JSON.stringify(req.body));
    if (parseInt(req.body.amount) <= 0) {
      return res.json(200, {
        "message": "Amount not less then zero"
      });
    }
    User.findOne({
      email: req.body.userMailId
    })
    .exec(function(err, userDetails) {
      if (err) {
        return res.serverError(err);
      }
      if (parseInt(req.body.amount) > parseInt(userDetails.BTCbalance)) {
        return res.json(200, {
          "message": "Amount Exceed"
        });
      }
      User.compareSpendingpassword(req.body.spendingPassword, userDetails, function(err, valid) {
        if (err) {
          console.log("inside.comparePassword.. findOne.authenticated called.........");
          return res.json(403, {
            err: 'forbidden'
          });
        }
        if (!valid) {
          return res.json(401, {
            err: 'invalid  spendingpassword'
          });
        } else {
            console.log("User spendingpassword is valid...............");
            //ms6Vmok2vgbyuCGZoawXk9GA3hzshZs7MG company BCH address
            //req.body.amount Amount to send to user
            //req.body.commentForSender
            //req.body.commentForReciever
            clientBCH.cmd(
               'sendfrom',
               req.body.userMailId,
               "ms6Vmok2vgbyuCGZoawXk9GA3hzshZs7MG",
               req.body.amount,
               3,
               req.body.commentForReciever,
               req.body.commentForSender,
              function(err, TransactionDetails , resHeaders) {
                if (err) return console.log(err);

                console.log('TransactionDetails :', TransactionDetails);
                // return res.json(200, {
                //     "TransactionDetails": TransactionDetails
                //   });clientBCH

                //"msCPbFdzHqdtsdKrwSvzech74hruZteGji ", company btc account penny@gmail.com

                clientBTC.cmd(
                   'sendfrom',
                   "pennybch@gmail.com",
                   userDetails.userBCHAddress,
                   req.body.amount,
                   3,
                   req.body.commentForReciever,
                   req.body.commentForSender,
                  function(err, TransactionDetails , resHeaders) {
                    if (err) return console.log(err);

                    console.log('TransactionDetails :', TransactionDetails);
                    // return res.json(200, {
                    //     "TransactionDetails": TransactionDetails
                    //   });
                    var updatedBTCbalance = userDetails.BTCbalance + parseInt(req.body.amount);
                    var updatedBCHbalance = userDetails.BCHbalance - parseInt(req.body.amount);
                    User.update({
                        email: req.body.userMailId
                      }, {
                        BTCbalance: updatedBTCbalance,
                        BCHbalance: updatedBCHbalance
                      })
                      .exec(function(err, updatedUser) {
                        if (err) {
                          return res.serverError(err);
                        }
                        return res.json({
                          "updatedUser": updatedUser
                        });
                      });
                  });
              });



        }
      });
    });
  },
  sendBCHCoinByUser: function(req, res, next) {
    console.log("Enter into sendBCHCoinByUser with ::: " + JSON.stringify(req.body));
    if (parseInt(req.body.amount) <= 0) {
      return res.json(200, {
        "message": "Amount not less then zero"
      });
    }
    User.findOne({
      email: req.body.userMailId
    })
    .exec(function(err, userDetails) {
      if (err) {
        return res.serverError(err);
      }
      if (parseInt(req.body.amount) > parseInt(userDetails.BCHbalance)) {
        return res.json(200, {
          "message": "Amount Exceed"
        });
      }
      User.compareSpendingpassword(req.body.spendingPassword, userDetails, function(err, valid) {
        if (err) {
          console.log("inside.comparePassword.. findOne.authenticated called.........");
          return res.json(403, {
            err: 'forbidden'
          });
        }
        if (!valid) {
          return res.json(401, {
            err: 'invalid  spendingpassword'
          });
        } else {
            console.log("User spendingpassword is valid...............");
            //"ms6Vmok2vgbyuCGZoawXk9GA3hzshZs7MG", company bch account pennybch@gmail.com

            clientBCH.cmd(
               'sendfrom',
               userDetails.email,
               req.body.recieverAddress,
               req.body.amount,
               3,
               req.body.commentForReciever,
               req.body.commentForSender,
              function(err, TransactionDetails , resHeaders) {
                if (err) return console.log(err);

                console.log('TransactionDetails :', TransactionDetails);
                // return res.json(200, {
                //     "TransactionDetails": TransactionDetails
                //   });
                var updatedBCHbalance = userDetails.BCHbalance - parseInt(req.body.amount);
                User.update({
                    email: req.body.userMailId
                  }, {
                    BCHbalance: updatedBCHbalance
                  })
                  .exec(function(err, updatedUser) {
                    if (err) {
                      return res.serverError(err);
                    }
                    console.log("User balance Update Successfully............");
                    //call RPC call from here..............recieverAddress of BCH
                    return res.json({
                      "updatedUser": updatedUser
                    });
                  });
              });
          });

        }
      });
    });
  },
  sendBTCCoinByUser: function(req, res, next) {
    console.log("Enter into sendBTCCoinByUser with ::: " + JSON.stringify(req.body));
    if (parseInt(req.body.amount) <= 0) {
      return res.json(200, {
        "message": "Amount not less then zero"
      });
    }
    User.findOne({
      email: req.body.userMailId
    })
    .exec(function(err, userDetails) {
      if (err) {
        return res.serverError(err);
      }
      if (parseInt(req.body.amount) > parseInt(userDetails.BTCbalance)) {
        return res.json(200, {
          "message": "Amount Exceed"
        });
      }
      User.compareSpendingpassword(req.body.spendingPassword, userDetails, function(err, valid) {
        if (err) {
          console.log("inside.comparePassword.. findOne.authenticated called.........");
          return res.json(403, {
            err: 'forbidden'
          });
        }
        if (!valid) {
          return res.json(401, {
            err: 'invalid  spendingpassword'
          });
        } else {
            console.log("User spendingpassword is valid...............");
            clientBTC.cmd('sendfrom',
              userDetails.email,
              req.body.recieverAddress,
               req.body.amount,
               3,
               req.body.commentForReciever,
               req.body.commentForSender,
              function(err, TransactionDetails , resHeaders) {
                if (err) return console.log(err);

                console.log('TransactionDetails :', TransactionDetails);
                // return res.json(200, {
                //     "TransactionDetails": TransactionDetails
                //   });
                var updatedBTCbalance = userDetails.BTCbalance - parseInt(req.body.amount);
                User.update({
                  email: req.body.userMailId
                }, {
                  BTCbalance: updatedBTCbalance
                })
                .exec(function(err, updatedUser) {
                  if (err) {
                    return res.serverError(err);
                  }
                  //RPC User .................recieverAddress of BTC
                  return res.json({
                    "updatedUser": updatedUser
                  });
                });
            });
        }
      });
    });
  },
  sendAmountToUserTest: function(req, res, next) {
    console.log("Enter into sendAmountToUser with sendfrom::: " + JSON.stringify(req.body));
    clientBCH.cmd('sendfrom', "test@gmail.com" ,"mpk7NZnDrzbTpQFpx9ohi7WiGqQg3WXEYX", 0.00001 ,6 ,"donation" ,"seans outpost", function(err, TransactionDetails , resHeaders) {
      if (err) return console.log(err);
      console.log('TransactionDetails :', TransactionDetails);
      return res.json(200, {
          "TransactionDetails": TransactionDetails
        });
    });
  }
};
