/**
 * @file       ship.js
 * @brief      舰船模型，处理舰船信息的CRUD操作和位置跟踪（已弃用，所有代码已注释）
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

// /**
//  * @class ShipModel
//  * @brief 舰船模型类，处理舰船信息的CRUD操作和位置跟踪（已弃用）
//  */
// class ShipModel {
//     /**
//      * @brief 查询所有舰船信息
//      * @returns {Promise<Array>} 返回所有舰船信息的数组
//      * @throws {Error} 数据库查询错误时抛出异常
//      */
//     static async findAll() {
//         try {
//             const results = await db.select('SEARCH_SHIP');
//             return results;
//         } catch (error) {
//             throw error;
//         }
//     }

//     /**
//      * @brief 根据舰船名称查询舰船信息
//      * @param {string} shipName - 舰船名称
//      * @returns {Promise<Array>} 返回匹配的舰船信息数组
//      * @throws {Error} 数据库查询错误时抛出异常
//      */
//     static async findByShipName(shipName) {

//         try {
//             const results = await db.select('SEARCH_SHIP', '*', `SHIP_NAME='${shipName}'`);
//             return results;
//         } catch (error) {
//             throw error;
//         }
//     }

//     /**
//      * @brief 根据舰船代码查询舰船信息及最新位置
//      * @param {string} ship_code - 舰船代码
//      * @returns {Promise<Array>} 返回包含舰船信息和最新位置的数组
//      * @throws {Error} 数据库查询错误时抛出异常
//      */
//     static async findByShipCode(ship_code) {
//         const sql=`SELECT * FROM  SEARCH_SHIP S LEFT JOIN
//         ( SELECT * FROM SEARCH_LOCATION M WHERE M.ID = ( SELECT MAX(T.ID) FROM SEARCH_LOCATION T  WHERE T.SHIP_CODE='${ship_code}' GROUP BY T.ID)
//         ) L ON S.SHIP_CODE=L.SHIP_CODE
//         WHERE S.SHIP_CODE = '${ship_code}'`
//         try {
//             // const results = await db.select('SEARCH_SHIP', '*', `SHIP_CODE=${ship_code}`);
//             const results = await db.selectBySql(sql);
//             return results;
//         } catch (error) {
//             throw error;
//         }
//     }

//     /**
//      * @brief 创建新的舰船记录
//      * @param {Object} ship - 舰船信息对象
//      * @returns {Promise<Object>} 返回创建结果
//      * @throws {Error} 数据库插入错误时抛出异常
//      */
//     static async create(ship) {

//         try {
//             const results = await db.insert('SEARCH_SHIP', ship);
//             return results;
//         } catch (error) {
//             throw error;
//         }
//     }

//     /**
//      * @brief 更新舰船在线状态
//      * @param {string} ship_code - 舰船代码
//      * @param {boolean} isOnline - 在线状态
//      * @returns {Promise<Object>} 返回更新结果
//      * @throws {Error} 数据库更新错误时抛出异常
//      */
//     static async updateStatus(ship_code, isOnline) {
//         try {
//             let ship = {
//                 isonline: isOnline
//             };
//             const results = await db.update('SEARCH_SHIP', ship, `SHIP_CODE=${ship_code}`);
//             return results;
//         } catch (error) {
//             throw error;
//         }
//     }

//     /**
//      * @brief 更新舰船信息
//      * @param {string} ship_code - 舰船代码
//      * @param {Object} ship - 更新的舰船信息对象
//      * @returns {Promise<Object>} 返回更新结果
//      * @throws {Error} 数据库更新错误时抛出异常
//      */
//     static async update(ship_code, ship) {

//         try {
//             const results = await db.update('SEARCH_SHIP', ship, `SHIP_CODE=${ship_code}`);
//             return results;
//         } catch (error) {
//             throw error;
//         }
//     }

//     /**
//      * @brief 删除舰船记录
//      * @param {string} ship_code - 舰船代码
//      * @returns {Promise<Object>} 返回删除结果
//      * @throws {Error} 数据库删除错误时抛出异常
//      */
//     static async delete(ship_code) {

//         try {
//             const results = await db.remove('SEARCH_SHIP', `SHIP_CODE=${ship_code}`);
//             return results;
//         } catch (error) {
//             throw error;
//         }
//     }
// }

// module.exports = ShipModel;
