/**
 * comp.js apis
 * @authors Joe Jiang (hijiangtao@gmail.com)
 * @date    2017-02-12 16:22:08
 * @version $Id$
 */

'use strict'
const lib = require('../../conf/lib');
const DATA = require('../../conf/data');
const EP = require('../../conf/entropy');

let apis = {
	'overviewQuery': function(req, res, next) {
		let params = req.query;
		console.info('Going to connect MySQL.');
		lib.connectMySQL().then(function(conn) {
			console.info('Got data from MySQL.');
			return EP.getOverview(conn, params)
		}, function(err) {
			console.error('error: ', err);
		}).catch(function(error) {
			console.error('error: ', err);
		}).then(function(result) {
			console.info('Ready to send back result.');
			res.json(result);
		})
	},
	'getJsonSum': function(req, res, next) {
		let params = req.query,
			table = params.table;

		lib.connectMySQL().then(function(conn) {
			console.info('Got data from MySQL.');
			conn.query("SELECT ? AS 'name', MAX(wpnumber) AS 'wpnumber', MAX(vpnumber) AS 'vpnumber', MAX(wrnumber) AS 'wrnumber', MAX(vrnumber) AS 'vrnumber', MAX(prsval) AS 'prsval', MAX(trsval) AS 'trsval', MAX(arsval) AS 'arsval', MAX(ppsval) AS 'ppsval', MAX(tpsval) AS 'tpsval', MAX(apsval) AS 'apsval' FROM ?? WHERE 1;", [table, table], function(err, result) {
				conn.release();

				res.json(result[0]);
			});
		}, function(err) {
			console.error('error: ', err);
		}).catch(function(error) {
			console.error('error: ', err);
		});
	},
	'getJsonAve': function(req, res, next) {
		let params = req.query,
			table = params.table;

		lib.connectMySQL().then(function(conn) {
			console.info('Got data from MySQL.');
			conn.query("SELECT ? AS 'name', MAX(wpnumber) AS 'wpnumber', MAX(vpnumber) AS 'vpnumber', MAX(wrnumber) AS 'wrnumber', MAX(vrnumber) AS 'vrnumber', MAX(prsval/vrnumber) AS 'prsval', MAX(trsval/wrnumber) AS 'trsval', MAX(arsval/wrnumber) AS 'arsval', MAX(ppsval/vpnumber) AS 'ppsval', MAX(tpsval/wpnumber) AS 'tpsval', MAX(apsval/wpnumber) AS 'apsval' FROM ?? WHERE 1;", [table, table], function(err, result) {
				conn.release();

				res.json(result[0]);
			});
		}, function(err) {
			console.error('error: ', err);
		}).catch(function(error) {
			console.error('error: ', err);
		});
	}
}

module.exports = apis
