/**
 * UserController
 *
 * @description :: Server-side logic for managing users
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var request = require('request');
var bitcoinBTC = require('bitcoin');
var bitcoinBCH = require('bitcoin');
var bcrypt = require('bcrypt');
var nodemailer = require('nodemailer');
var BlockIo = require('block_io');
var version = 2;
var secreatePin="Saddam1508";
var block_io = new BlockIo('7ba8-e0ba-8223-7bbe', 'Saddam1508', version);
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
    if (!req.body.password || !req.body.confirmPassword || !req.body.email || !req.body.spendingpassword) {
      console.log("Invalid Parameter by user.....");
      return res.json(401, {
        "message": "Invalid Parameter"
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
  sendBTCCoinByUserWithFee: function(req, res, next) {
    console.log("Enter into sendBTCCoinByUserWithFee with ::: " + JSON.stringify(req.body));
    if(!req.body.userMailId ||
      !req.body.amount  ||
      !req.body.recieverBTCCoinAddress||
      !req.body.spendingPassword||
      !req.body.commentForReciever ||
      !req.body.commentForSender){
      console.log("Invalid Parameter by user.....");
      return res.json(401, {
        "message": "Invalid Parameter"
      });
    }
    if (parseFloat(req.body.amount).toFixed(8) <= 0.0001) {
      console.log("amount in not less the zero............");
      return res.json(400, {
        "message": "Amount not less then zero"
      });
    }

    User.findOne({
        email: req.body.userMailId
      })
      .exec(function(err, userDetails) {
        if (err) {
          console.log("Error to get userDetails.................");
          return res.serverError(err);
        }
        console.log("UserAMount in database ::: " + userDetails.BTCbalance);
        console.log("req.body.amount ::: " + parseFloat(req.body.amount).toFixed(8));

        if (parseFloat(req.body.amount).toFixed(8) > parseFloat(userDetails.BTCbalance).toFixed(8)) {
          console.log(parseFloat(req.body.amount).toFixed(8) + " Amount Exceed " + userDetails.BTCbalance);
          return res.json(400, {
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

            console.log(" ::User spendingpassword is valid..............." + JSON.stringify(req.body.userMailId));
            clientBTC.cmd('sendfrom',
              req.body.userMailId,
              req.body.recieverBTCCoinAddress,
              req.body.amount,
              3,
              req.body.commentForReciever,
              req.body.commentForSender,
              function(err, TransactionDetails, resHeaders) {
                console.log(" Error to send BTC to server .....");
                if (err) return console.log(err);
                console.log('TransactionDetails :', TransactionDetails);
                console.log("User balance :: " + userDetails.BTCbalance);
                console.log("req.body.amount balance :: " + req.body.amount);
                clientBTC.cmd('gettransaction', TransactionDetails,
                  function(err, compleateTransactionDetails, resHeaders) {
                    if (err) return console.log(err);
                    console.log("Fee :: " + parseFloat(Math.abs(compleateTransactionDetails.fee)).toFixed(8));

                    var updatedBTCbalance = (parseFloat(userDetails.BTCbalance).toFixed(8) -
                      parseFloat(req.body.amount).toFixed(8));
                    updatedBTCbalance = updatedBTCbalance - parseFloat(Math.abs(compleateTransactionDetails.fee)).toFixed(8);

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
                        User
                          .findOne({
                            email: req.body.userMailId
                          })
                          .populateAll()
                          .then(function(user) {
                            console.log("User return "+JSON.stringify(user));
                            res.json({
                              user: user
                            });
                          })
                          .catch(function(err) {
                            if (err) return res.serverError(err);
                          });
                        // console.log("updatedUser balance :: " + JSON.stringify(updatedUser.BTCbalance));
                        // return res.json({
                        //   "user": updatedUser
                        // });
                      });

                  });


              });
          }
        });
      });

  },
  sendBCHCoinByUserWithFee: function(req, res, next) {
    console.log("Enter into sendBCHCoinByUserWithFee with ::: " + JSON.stringify(req.body));
    if(!req.body.userMailId ||
      !req.body.amount  ||
      !req.body.recieverBCHCoinAddress||
      !req.body.spendingPassword||
      !req.body.commentForReciever ||
      !req.body.commentForSender){
      console.log("Invalid Parameter by user.....");
      return res.json(401, {
        "message": "Invalid Parameter"
      });
    }
    if (parseFloat(req.body.amount).toFixed(8) <= 0.0001) {
      console.log("amount in not less the zero............");
      return res.json(400, {
        "message": "Amount not less then zero"
      });
    }

    User.findOne({
        email: req.body.userMailId
      })
      .exec(function(err, userDetails) {
        if (err) {
          console.log("Error to get userDetails.................");
          return res.serverError(err);
        }
        console.log("UserAMount in database ::: " + userDetails.BCHbalance);
        console.log("req.body.amount ::: " + parseFloat(req.body.amount).toFixed(8));

        if (parseFloat(req.body.amount).toFixed(8) > parseFloat(userDetails.BCHbalance).toFixed(8)) {
          console.log(parseFloat(req.body.amount).toFixed(8) + " Amount Exceed " + userDetails.BCHbalance);
          return res.json(400, {
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

            console.log(" ::User spendingpassword is valid..............." + JSON.stringify(req.body.userMailId));
            clientBCH.cmd('sendfrom',
              req.body.userMailId,
              req.body.recieverBCHCoinAddress,
              req.body.amount,
              3,
              req.body.commentForReciever,
              req.body.commentForSender,
              function(err, TransactionDetails, resHeaders) {
                if (err) return console.log(err);
                console.log('TransactionDetails :', TransactionDetails);
                console.log("User balance :: " + userDetails.BCHbalance);
                console.log("req.body.amount balance :: " + req.body.amount);
                clientBCH.cmd('gettransaction', TransactionDetails,
                  function(err, compleateTransactionDetails, resHeaders) {
                    if (err) return console.log(err);

                    console.log("Fee :: " + parseFloat(Math.abs(compleateTransactionDetails.fee)).toFixed(8));

                    var updatedBCHbalance = (parseFloat(userDetails.BCHbalance).toFixed(8) -
                      parseFloat(req.body.amount).toFixed(8));
                    updatedBCHbalance = updatedBCHbalance - parseFloat(Math.abs(compleateTransactionDetails.fee)).toFixed(8);

                    User.update({
                        email: req.body.userMailId
                      }, {
                        BCHbalance: updatedBCHbalance
                      })
                      .exec(function(err, updatedUser) {
                        if (err) {
                          return res.serverError(err);
                        }
                        User
                          .findOne({
                            email: req.body.userMailId
                          })
                          .populateAll()
                          .then(function(user) {
                            console.log("User return "+JSON.stringify(user));
                            res.json({
                              user: user
                            });
                          })
                          .catch(function(err) {
                            if (err) return res.serverError(err);
                          });
                        //RPC User .................recieverAddress of BCH
                        // console.log("updatedUser balance :: " + JSON.stringify(updatedUser));
                        // return res.json({
                        //   "user": updatedUser
                        // });
                      });

                  });


              });
          }
        });
      });

  },
  sellBCHCoinByUserWithFee: function(req, res, next) {
    console.log("Enter into sendBCHCoinByUserWithFee with ::: " + JSON.stringify(req.body));
    var companyBTCAccountAddress="muWUXrJiKp28J3SCZ2KuGXHfBvYJZPVjY5";
    var companyBTCAccount="pennybaseBTC@gmail.com";
    var companyBCHAccount="pennybch@gmail.com";
    var companyBCHAccountAddress="ms6Vmok2vgbyuCGZoawXk9GA3hzshZs7MG";
    if(!req.body.userMailId ||
      !req.body.amount  ||
      !req.body.spendingPassword||
      !req.body.commentForReciever ||
      !req.body.commentForSender){
      console.log("Invalid Parameter by user.....");
      return res.json(401, {
        "message": "Invalid Parameter"
      });
    }
    if (parseFloat(req.body.amount).toFixed(8) <= 0.0001) {
      console.log("amount in not less the zero............");
      return res.json(400, {
        "message": "Amount not less then zero"
      });
    }
    User.findOne({
        email: req.body.userMailId
      })
      .exec(function(err, userDetails) {
        if (err) {
          console.log("Error to get userDetails.................");
          return res.serverError(err);
        }
        console.log("UserAMount in database ::: " + userDetails.BCHbalance);
        console.log("req.body.amount ::: " + parseFloat(req.body.amount).toFixed(8));
        if (parseFloat(req.body.amount).toFixed(8) > parseFloat(userDetails.BCHbalance).toFixed(8)) {
          console.log(parseFloat(req.body.amount).toFixed(8) + " Amount Exceed " + userDetails.BCHbalance);
          return res.json(400, {
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
            console.log("User spendingpassword is valid..............." + JSON.stringify(req.body.userMailId));
            //SendFrom for UsermailId to companyBCHAccountAddress
            clientBCH.cmd('sendfrom',
              req.body.userMailId,
              companyBCHAccountAddress,
              parseFloat(req.body.amount).toFixed(8),
              3,
              req.body.commentForReciever,
              req.body.commentForSender,
              function(err, TransactionBCHTxId, resHeaders) {
                if (err) return console.log(err);
                console.log('UserMailid To Company Mailid Succesfully txid : ', TransactionBCHTxId);
                console.log("User BCH balance :: " + userDetails.BCHbalance);
                console.log("Amount send by user :: " + req.body.amount);
                //GetTransaction Fees for BCHTransaction
                clientBCH.cmd('gettransaction', TransactionBCHTxId,
                  function(err, compleateTransactionBCHDetails, resHeaders) {
                    if (err) return console.log(err);
                    console.log("Fee :: " + parseFloat(Math.abs(compleateTransactionBCHDetails.fee)).toFixed(8));
                    var updatedBCHbalance = (parseFloat(userDetails.BCHbalance).toFixed(8) - parseFloat(req.body.amount).toFixed(8));
                    updatedBCHbalance = updatedBCHbalance - parseFloat(Math.abs(compleateTransactionBCHDetails.fee)).toFixed(8);
                    //SendFrom for companyBTCAccount to userBTCAddress
                    clientBTC.cmd('sendfrom',
                      companyBTCAccount,
                      userDetails.userBTCAddress,
                      req.body.amount,
                      3,
                      req.body.commentForSender,
                      req.body.commentForReciever,
                      function(err, TransactionBTCTxId, resHeaders) {
                        if (err) return console.log(err);
                        console.log('TransactionDetails :', TransactionBTCTxId);
                        console.log("User balance :: " + userDetails.BCHbalance);
                        console.log("req.body.amount balance :: " + req.body.amount);
                        //gettransaction details using Transaction BTC
                        clientBTC.cmd('gettransaction', TransactionBTCTxId,
                          function(err, compleateTransactionDetailsBTC, resHeaders) {
                            if (err) return console.log(err);
                            console.log("Fee :: " + parseFloat(Math.abs(compleateTransactionDetailsBTC.fee)).toFixed(8));
                            console.log("UserBTC current Balance ::: "+parseFloat(userDetails.BTCbalance).toFixed(8));
                            var updatedBTCbalance = (parseFloat(userDetails.BTCbalance) + parseFloat(req.body.amount)).toFixed(8);
                            updatedBTCbalance = updatedBTCbalance - parseFloat(Math.abs(compleateTransactionDetailsBTC.fee)).toFixed(8);
                            console.log("BTCBalance to Update :: "+parseFloat(updatedBTCbalance).toFixed(8));
                            console.log("BCHBalance to Update :: "+updatedBCHbalance);
                            User.update({
                                email: req.body.userMailId
                              }, {
                                BCHbalance: updatedBCHbalance,
                                BTCbalance: parseFloat(updatedBTCbalance).toFixed(8)
                              })
                              .exec(function(err, updatedUser) {
                                if (err) {
                                  return res.serverError(err);
                                }
                                //RPC User .................recieverAddress of BCH
                                // console.log("updatedUser balance :: " + JSON.stringify(updatedUser));
                                // return res.json({
                                //   "user": updatedUser
                                // });
                                User
                                  .findOne({
                                    email: req.body.userMailId
                                  })
                                  .populateAll()
                                  .then(function(user) {
                                    console.log("User return "+JSON.stringify(user));
                                    res.json({
                                      user: user
                                    });
                                  })
                                  .catch(function(err) {
                                    if (err) return res.serverError(err);
                                  });
                              });
                          });
                      });
                  });
              });
          }
        });
      });
  },
  buyBCHCoinByUserWithFee: function(req, res, next) {
    console.log("Enter into sendBCHCoinByUserWithFee with ::: " + JSON.stringify(req.body));
    if(!req.body.userMailId ||!req.body.amount ||!req.body.spendingPassword ||!req.body.commentForReciever ||!req.body.commentForSender){
      console.log("Invalid Parameter by user.....");
      return res.json(401, {
        "message": "Invalid Parameter"
      });
    }
    if (parseFloat(req.body.amount).toFixed(8) <= 0.0001) {
      console.log("amount in not less the zero............");
      return res.json(400, {
        "message": "Amount not less then 0.0001"
      });
    }
    User.findOne({
        email: req.body.userMailId
      })
      .exec(function(err, userDetails) {
        if (err) {
          console.log("Error to get userDetails.................");
          return res.serverError(err);
        }

        console.log("UserAMount in database ::: " + JSON.stringify(userDetails));
        console.log("req.body.amount ::: " + parseFloat(req.body.amount).toFixed(8));

        if (parseFloat(req.body.amount).toFixed(8) > parseFloat(userDetails.BTCbalance).toFixed(8)) {
          console.log(parseFloat(req.body.amount).toFixed(8) + " Amount Exceed " + userDetails.BTCbalance);
          return res.json(400, {
            "message": "Amount Exceed"
          });
        }
        User.compareSpendingpassword(req.body.spendingPassword, userDetails, function(err, valid) {
          if (err) {
            console.log("Error to Compare SpendingPassword password.........");
            return res.json(403, {
              err: 'forbidden'
            });
          }
          if (!valid) {
            console.log("Invalid Compare SpendingPassword password.........");
            return res.json(401, {
              err: 'invalid  spendingpassword'
            });
          } else {

            var companyBTCAccountAddress="muWUXrJiKp28J3SCZ2KuGXHfBvYJZPVjY5";
            var companyBTCAccount="pennybaseBTC@gmail.com";
            var companyBCHAccount="pennybch@gmail.com";
            var companyBCHAccountAddress="ms6Vmok2vgbyuCGZoawXk9GA3hzshZs7MG";
            console.log("User spendingpassword is valid..............." + JSON.stringify(req.body.userMailId));
            //SendFrom for UsermailId to companyBCHAccountAddress
            clientBTC.cmd('sendfrom',
              req.body.userMailId,
              companyBTCAccountAddress,
              parseFloat(req.body.amount).toFixed(8),
              3,
              req.body.commentForReciever,
              req.body.commentForSender,
              function(err, TransactionBTCTxId, resHeaders) {
                if (err) return console.log(err);
                console.log('UserMailid To Company Mailid Succesfully txid : ', TransactionBTCTxId);
                console.log("User BCH balance :: " + userDetails.BCHbalance);
                console.log("Amount send by user :: " + req.body.amount);
                //GetTransaction Fees for BCHTransaction
                clientBCH.cmd('gettransaction', TransactionBTCTxId,
                  function(err, compleateTransactionBTCDetails, resHeaders) {
                    if (err) return console.log(err);

                    console.log("Fee :: " + parseFloat(Math.abs(compleateTransactionBTCDetails.fee)).toFixed(8));
                    var updatedBTCbalance = (parseFloat(userDetails.BTCbalance).toFixed(8) - parseFloat(req.body.amount).toFixed(8));
                    updatedBTCbalance = updatedBTCbalance - parseFloat(Math.abs(compleateTransactionBTCDetails.fee)).toFixed(8);
                    //SendFrom for companyBTCAccount to userBTCAddress

                    clientBTC.cmd('sendfrom',
                      companyBCHAccount,
                      userDetails.userBCHAddress,
                      req.body.amount,
                      3,
                      req.body.commentForSender,
                      req.body.commentForReciever,
                      function(err, TransactionBCHTxId, resHeaders) {
                        if (err) return console.log(err);
                        console.log('TransactionDetails :', TransactionBCHTxId);
                        console.log("User balance :: " + userDetails.BCHbalance);
                        console.log("req.body.amount balance :: " + req.body.amount);
                        //gettransaction details using Transaction BTC
                        clientBTC.cmd('gettransaction', TransactionBCHTxId,
                          function(err, compleateTransactionDetailsBCH, resHeaders) {

                            if (err) return console.log(err);
                            console.log("Fee :: " + parseFloat(Math.abs(compleateTransactionDetailsBCH.fee)).toFixed(8));
                            console.log("UserBTC current Balance ::: "+parseFloat(userDetails.BTCbalance).toFixed(8));

                            var updatedBCHbalance = (parseFloat(userDetails.BCHbalance) + parseFloat(req.body.amount)).toFixed(8);
                            updatedBCHbalance = updatedBCHbalance - parseFloat(Math.abs(compleateTransactionDetailsBCH.fee)).toFixed(8);

                            console.log("BTCBalance to Update :: "+parseFloat(updatedBTCbalance).toFixed(8));
                            console.log("BCHBalance to Update :: "+updatedBCHbalance);

                            User.update({
                                email: req.body.userMailId
                              }, {
                                BCHbalance: updatedBCHbalance,
                                BTCbalance: updatedBTCbalance
                              })
                              .exec(function(err, updatedUser) {
                                if (err) {
                                  return res.serverError(err);
                                }

                                  User
                                    .findOne({
                                      email: req.body.userMailId
                                    })
                                    .populateAll()
                                    .then(function(user) {
                                      console.log("User return "+JSON.stringify(user));
                                      res.json({
                                        user: user
                                      });
                                    })
                                    .catch(function(err) {
                                      if (err) return res.serverError(err);
                                    });
                                //RPC User .................recieverAddress of BCH
                                // console.log("updatedUser balance :: " + JSON.stringify(updatedUser));
                                // res.json(updatedUser, 201);

                              });
                          });
                      });
                  });
              });
          }
        });
      });
  },
  getTransactionList: function(req, res, next) {
    console.log("Enter into getTransactioList::: " + JSON.stringify(req.body));
    if(!req.body.userMailId){
      console.log("Invalid Parameter by user.....");
      return res.json(401, {
        "message": "Invalid Parameter"
      });
    }
    clientBCH.cmd(
      'listtransactions',
      req.body.userMailId,
      function(err, transactionList, resHeaders) {
        if (err) return console.log(err);
        console.log("Return Transaction List :: "+JSON.stringify(transactionList));
        res.json(200,transactionList);
      });

  },
  getCurrentBalance: function(req, res, next) {
    console.log("Enter into getTransactioList::: " + JSON.stringify(req.body));
    if(!req.body.userMailId){
      console.log("Invalid Parameter by user.....");
      return res.json(401, {
        "message": "Invalid Parameter"
      });

    }
    User
      .findOne({
        email: req.body.userMailId
      })
      .then(function(user) {
        console.log("User return "+JSON.stringify(user));
        console.log("UserBCH Balance ::"+user.BCHbalance);
        clientBCH.cmd(
          'getbalance',
          req.body.userMailId,
          function(err, userBCHBalanceFromServer, resHeaders) {
            if (err) return console.log(err);
            console.log("Return Transaction List :: "+JSON.stringify(userBCHBalanceFromServer));
            if(parseFloat(userBCHBalanceFromServer).toFixed(8)>parseFloat(user.BCHbalance).toFixed(8)){
              console.log("UserBalance Need to update ............");

              User.update({
                  email: req.body.userMailId
                }, {
                  BCHbalance: userBCHBalanceFromServer
                })
                .exec(function(err, updatedUser) {
                  if (err) {
                    return res.serverError(err);
                  }
                  User
                    .findOne({
                      email: req.body.userMailId
                    })
                    .then(function(userUpdated) {
                      console.log("User return "+JSON.stringify(userUpdated));
                      res.json({
                        user: userUpdated
                      });
                    })
                    .catch(function(err) {
                      if (err) return res.serverError(err);
                    });
                });
            }else {
              res.json({
                "message": "No need to update"
              });
            }
          });
      })
      .catch(function(err) {
        if (err) return res.serverError(err);
      });
  },
  sendEmailTest: function(req, res, next) {
    console.log("Enter into sendEmailTest::: " + JSON.stringify(req.body));
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'wallet.bcc@gmail.com',
        pass: 'boosters@123'
      }
    });
    var mailOptions = {
      from: 'wallet.bcc@gmail.com',
      to: 'bccwalletsuport@gmail.com',
      subject: 'Sending Email using Node.js',
      text: 'That was easy!'
    };
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
        res.json(200,"Message Send Succesfully");
      }
    });
  },
  blockIoTest: function(req, res, next) {
    console.log("Enter into sendEmailTest::: " + JSON.stringify(req.body));
    block_io.get_address_balance(
      {'address': '2N4iBd2rsb2JRxn5uDuxH1jr6x3Jn1nSkzB'},
      function(err, TransactionDetails) {
        if (err) return res.json(err);
        console.log("Value of responseBlockIo: "+JSON.stringify(TransactionDetails));
        return res.json(TransactionDetails);
      });
  },
  getCurrntPriceOfBTC: function(req, res, next) {
    console.log("Enter into getCurrntPriceOfBTC::: " + JSON.stringify(req.body));

      request.get({
        url: "https://cex.io/api/ticker/BCH/BTC"
      }, function(error, response, body) {

        if (error) {
          sails.log.error(error);
          return res.json(JSON.parse(error));
        }
        else {
          // sails.log.info(response);
          // sails.log.info(JSON.parse(body));
          return res.json(JSON.parse(body));
        }
      });
    //Call RPC For get current balance of BTC
  },
  forgotPassword: function(req, res, next) {

    if(!req.body.userMailId){
      console.log("Invalid Parameter by user.....");
      return res.json(401, {
        "message": "Invalid Parameter"
      });
    }
    //console.log("Enter into getCurrntPriceOfBTC::: " + Math.floor(Math.random() * 10000000000));
    // return res.json(200, {
    //   "message": Math.floor(Math.random() * 10000000000)
    // });
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'wallet.bcc@gmail.com',
        pass: 'boosters@123'
      }
    });
    var newCreatedPassword=Math.floor(Math.random() * 10000000000);
    var mailOptions = {
      from: 'wallet.bcc@gmail.com',
      to: req.body.userMailId,
      subject: 'New password of BCH wallet',
      text: 'Hi, \n Your new password of your account is '+newCreatedPassword
    };
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log(newCreatedPassword+'Email sent: ' + info.response);
        //res.json(200,"Message Send Succesfully");
        console.log("createing encryptedPassword ....");
        bcrypt.hash(newCreatedPassword.toString(), 10, function (err, hash) {
          if(err) return next(err);
          var newEncryptedPass = hash;
          User.update({
              email: req.body.userMailId
            }, {
              encryptedPassword: newEncryptedPass
            })
            .exec(function(err, updatedUser) {
              if (err) {
                return res.serverError(err);
              }
              //Call RPC ......
              console.log("return updated data............");
              return res.json({
                "updatedUser": updatedUser
              });
            });

        });

      }
    });
    //Call RPC For get current balance of BTC
  },
  updatePassword: function(req, res, next) {

    if(!req.body.userMailId ||!req.body.currentPassword||!req.body.newPassword){
      console.log("Invalid Parameter by user.....");
      return res.json(401, {
        "message": "Invalid Parameter"
      });
    }
    User
      .findOne({
        email: req.body.userMailId
      })
      .then(function(err,userDetails) {
        if (err) {
          console.log("inside.comparePassword.. findOne.authenticated called.........");
          return res.json(403, {
            err: 'User not found'
          });
        }
        User.comparePassword(req.body.currentPassword, userDetails,
          function(err, valid) {
          if (err) {
            console.log("inside.comparePassword.. findOne.authenticated called.........");
            return res.json(403, {
              err: 'Error currentpassword'
            });
          }
          if (!valid) {
            return res.json(401, {
              err: 'Please enter correct password'
            });
          } else {
            console.log("User currentpassword is valid...............");
            bcrypt.hash(req.body.newPassword, 10, function (err, hash) {
              if(err) return next(err);

              User.update({
                  email: req.body.userMailId
                }, {
                  encryptedPassword: hash
                })
                .exec(function(err, updatedUser) {
                  if (err) {
                    return res.serverError(err);
                  }
                  //Call RPC ......
                  console.log("return updated data............");
                  return res.json({
                    "updatedUser": updatedUser
                  });
                });
            });
          }
        });
      })
      .catch(function(err) {
        console.log("lllllllllllllllllllllllllllllllllllll"+err.TypeError);

        return res.json(401,{"message":"Error to get userDetails"});

      });
    //Call RPC For get current balance of BTC
  },
  getCurrntPriceOfBCH: function(req, res, next) {
    console.log("Enter into sendEmailTest::: " + JSON.stringify(req.body));
        //Call RPC For get current balance of BTC

  },
  sendBTCToAnotherAddressBI: function(req, res, next) {
    console.log("Enter into sendEmailTest::: " + JSON.stringify(req.body));
    if(!req.body.userMailId ||
       !req.body.amount  ||
       !req.body.commentForReciever ||
       !req.body.commentForSender){
      console.log("Invalid Parameter by user.....");
      return res.json(401, {
        "message": "Invalid Parameter"
      });
    }
    User
      .findOne({
        email: req.body.userMailId
      })
      .then(function(userDetails) {
        console.log("User return "+JSON.stringify(userDetails));
        User.compareSpendingpassword(req.body.spendingPassword, userDetails,
          function(err, valid) {
          if (err) {
            console.log("inside.comparePassword.. findOne.authenticated called.........");
            return res.json(401, {
              err: 'Error to comparePassword'
            });
          }
          if (!valid) {
            return res.json(401, {
              err: 'Invalid  Spendingpassword'
            });
          } else {
            console.log("User spendingpassword is valid...............");
              block_io.withdraw_from_addresses(
              {
                'amounts': req.body.amount,
                'from_addresses': "2N4iBd2rsb2JRxn5uDuxH1jr6x3Jn1nSkzB323233",
                'to_addresses':  "n3fac5X71FKCvo8TMtCu7jsRobdZgLeck6",
                'pin': secreatePin
              },
              function (error, data) {
                //if (error) return console.log("Error occured:", error.message);
                if (error) {
                  //return console.log("Error occured:", error.message);
                  console.log("Value of err responseBlockIo: "+JSON.stringify(data));
                  return res.json(404,data);
                }

                console.log(data);
              }
                // function(err, sendTransactionDetails,tests) {
                //   if (err) {
                //     console.log("Value of err responseBlockIo: ");
                //     console.log(err);
                //     console.log("return from here.........");
                //     return res.json(401,err);
                //   }
                //   if(tests){
                //     console.log("Value of tests responseBlockIo: "+JSON.stringify(tests));
                //     return res.json(tests);
                //   }
                //   console.log("Value of responseBlockIo: "+JSON.stringify(sendTransactionDetails));
                //   return res.json(sendTransactionDetails);
                // }
              );
          }
        });
      })
      .catch(function(err) {
        if (err) return res.serverError(err);
      });
  }

};
