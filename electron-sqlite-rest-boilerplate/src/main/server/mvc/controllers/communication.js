/**
 * @file       communication.js
 * @brief      通信控制器，负责处理通信服务相关的HTTP请求（当前已注释）
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

// const CoummunicationService = require("../services/communicationService");

// class CoummunicationController {
//   /**
//    * 北斗一对一
//    * @param {*} req
//    * @param {*} res
//    */
//   static async oneToOneByBeiDou(req, res) {
//     try {
//       const userData = req.body;
//       const result = await CoummunicationService.insertCommunicationRecords(
//         userData
//       );
//       res.apiSuccess(result);
//     } catch (error) {
//       res.apiError();
//     }
//   }
//   /**
//    * 北斗一对多
//    * @param {*} req
//    * @param {*} res
//    */
//   static async oneToGroupByBeiDou(req, res) {
//     try {
//       const userData = req.body;
//       const result = await CoummunicationService.insertCommunicationRecords(
//         userData
//       );
//       res.apiSuccess(result);
//     } catch (error) {
//       res.apiError();
//     }
//   }
//   /**
//    * 天通一对一
//    * @param {*} req
//    * @param {*} res
//    */
//   static async oneToOneByTianTong(req, res) {
//     try {
//       const userData = req.body;
//       const result = await CoummunicationService.insertCommunicationRecords(
//         userData
//       );
//       res.apiSuccess(result);
//     } catch (error) {
//       res.apiError();
//     }
//   }
//   /**
//    * 天通一对多
//    * @param {*} req
//    * @param {*} res
//    */
//   static async oneToGroupByTianTong(req, res) {
//     try {
//       const userData = req.body;
//       const result = await CoummunicationService.insertCommunicationRecords(
//         userData
//       );
//       res.apiSuccess(result);
//     } catch (error) {
//       res.apiError();
//     }
//   }
//   /**
//    * 微波协同一对多
//    * @param {*} req
//    * @param {*} res
//    */
//   static async oneToGroupByMicroWare(req, res) {
//     try {
//       const userData = req.body;
//       const result = await CoummunicationService.insertCommunicationRecords(
//         userData
//       );
//       res.apiSuccess(result);
//     } catch (error) {
//       res.apiError();
//     }
//   }
//   /**
//    * 超短波一对多
//    * @param {*} req
//    * @param {*} res
//    */
//   static async oneToGroupByUHF(req, res) {
//     try {
//       const userData = req.body;
//       const result = await CoummunicationService.insertCommunicationRecords(
//         userData
//       );
//       res.apiSuccess(result);
//     } catch (error) {
//       res.apiError();
//     }
//   }
// }

// module.exports = CoummunicationController;
