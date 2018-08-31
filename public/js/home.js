/**
 * home.js
 * @authors Joe Jiang (hijiangtao@gmail.com)
 * @date    2017-03-17 10:00:09
 * @version $Id$
 */

'use strict'

import Vue from 'vue'

import mapview from './components/hmap-view'
import chart from './components/chartview'
import $ from "jquery"
import {
    regionRecords,
    home,
    smecAve
} from './components/init'
import {
    getOverviewDatasets,
    getBoundaryDatasets,
    getClusterboundaryDatasets,
    getClusterboundaryDatasetsUpdate,
    getDistrictClusterDatasets,
	getThreetypeDatasets,
    getAOIDatasets,
    getDensity,
    getSMecDatasets,
    getDrawProps,
	getDrawProps_bubble,
    getAoiDisDatasets,
    objClone
} from './components/apis'
import {
    changeLoadState
} from './components/events'
import vueSlider from 'vue-slider-component'
import dynamicView from './dynamic'
import store from './vuex'

let maps = [],
    charts = [],
    daview = null,
    resp = null;

// 界面实例入口
const userpanel = new Vue({
    el: '#main',
    data: home,
    store,
    components: {
        vueSlider
    },
    methods: {
        /**
         * Metric Layer 下拉菜单
         * @param  {[type]} val [description]
         * @return {[type]}     [description]
         */
        'enpsDropdown': function (val) {
            let index = this.sels.lstindex;
            this.sels.objs[index]['etype'] = val;
            this.getOverview(index);
        },
        /**
         * Reference Layer 下拉菜单
         * @param  {[type]} val [description]
         * @return {[type]}     [description]
         */
        'refsDropdown': function (val) {
            this.sels['otype'] = val;
        },
        /**
         * POI 类别选择下拉菜单，未完善
         * @param  {[type]} val [description]
         * @return {[type]}     [description]
         */
        'poisDropdown': function (val) {
            val = Number.parseInt(val);
            this.sels['ptype'] = val;
            console.log(val);

            if (val === 2) {
                let i = 0;
                changeLoadState(`dimmer${i}`, true);
                getAOIDatasets(this.sels.objs[0].city, val).then(function (res) {
                    console.log('Get AOI data.')

                    let prop = {
                        'thre': 0
                    };
                    changeLoadState(`dimmer${i}`, false);
                    maps[i].aoisDrawing(res, prop);
                }).catch(function (err) {
                    console.error("Failed!", err);
                })
            }
        },

        /**
         * 从服务器拉取 entropy 以及 density 数据并显示在相应 map 板块
         * @param  {[type]} index map 面板编号
         * @return {[type]}       [description]
         */
        'getOverview': function (index) {
            let self = this,
                svals = null;

            index = Number.parseInt(index);

            // 当前 index 不在合法的阈值范围内
            if (index > 3) {
                alert('Selected object is out of index.');
            }

            // 判断是单个对象绘制还是多个对象绘制, 多对象 index 值为 -1
            let objs = self.sels.objs;
            //console.log(objs[0]);

            for (let i = objs.length - 1; i >= 0; i--) {
                if (index !== -1) {
                    i = Number.parseInt(index);
                }
				self.sels.objs[i].slider.min = 0;
				self.sels.objs[i].slider.max = 100;
				self.sels.objs[i].slider.interval = 0.5;
				self.sels.objs[i].slider.value = [0,100];
				self.sels.objs[i].slider.formatter = function (value) {
                    //console.log("value" + (value + 1))
                    return (100 / Math.log(101) * Math.log(value + 1)).toFixed(2) + "%"
                };
				
                svals = self.sels.objs[i].slider.value; //滑动条范围

                console.log("vals:" + svals)

                let obj = objs[i],
                    city = obj.city,
                    etype = obj.etype,
                    rev = obj.reverse,
                    drawprop = {
                        'etype': etype,
                        'rev': rev
                    };
                console.log("etype:" +  JSON.stringify(drawprop))

                // 添加 loading 效果 & 移动地图
                changeLoadState(`dimmer${i}`, true);
                maps[i].panTo(regionRecords[city]['center']);
				maps[i].boundaryRemove();

                // 根据用户所选 metric 类型进行相应数据提取操作
                if (['pp', 'pd', 'rp', 'rd', 'de'].indexOf(etype) > -1) {
                    // 获取 entropy 和 density 资源
					maps[i].clearLayers();
                    getOverviewDatasets(obj).then(function (res) {
                        changeLoadState(`dimmer${i}`, false);

                        //obj.scales = res['prop']['scales'];
                        resp = res;

                        // 获取 slider 情况下的配置值域以及用户其余选项
                        let drawProps = getDrawProps(res, svals, self.sels.ctrsets, drawprop);
                        //let drawProps = getDrawProps(obj.scales, svals, self.sels.ctrsets, drawprop);
                        //console.log('drawProps', drawProps);

                        // 绘 Metric Distribution 图函数
                        maps[i].mapcontourCDrawing(res, drawProps);
                        let prop = {
                            'xname': self.cals.enps[obj.etype],
                            'yprop': obj.etype
                        }
                        if (etype === 'de') {
                            charts[i].lineChartDraw(`estatChart${i}`, res['chart']['d'], prop); //绘制line图
                        } else {
                            charts[i].lineChartDraw(`estatChart${i}`, res['chart']['e'], prop);
                        }

                        /*                 
                        // 更新最大值域范围
                        obj.scales = res['prop']['scales'];
                        //console.log("obj.scales:" + JSON.stringify(obj.scales))

                        // 获取 slider 情况下的配置值域以及用户其余选项
                        let drawProps = getDrawProps(obj.scales, svals, self.sels.ctrsets, drawprop);
                        console.log('drawProps', drawProps);

                        // 绘 Metric Distribution 图函数
                        maps[i].mapcontourCDrawing(res, drawProps);
                        let prop = {
                            'xname': self.cals.enps[obj.etype],
                            'yprop': obj.etype
                        }
                        if (etype === 'de') {
                            charts[i].lineChartDraw(`estatChart${i}`, res['chart']['d'], prop);
                        } else {
                            charts[i].lineChartDraw(`estatChart${i}`, res['chart']['e'], prop);
                        }
*/
                        // 绘不同行政区数值分布函数
                        getSMecDatasets(city).then(function (cres) {
                            charts[i].barChartDraw(city, `poiChart${i}`, cres, prop);
                        }).catch(function (err) {
                            console.error("Failed!", err);
                        });

                        // 绘不同POI类别概率分布函数
                        getAoiDisDatasets(city, 'TOTAL').then(function (cres) {
                            charts[i].poiBarChartDraw(`disChart${i}`, cres, prop);
                        }).catch(function (err) {
                            console.error("Failed!", err);
                        });
                    }).catch(function (err) {
                        console.error("Failed!", err);
                    });
                }
				else if(['ppb', 'pdb', 'rpb', 'rdb', 'ppbo', 'pdbo', 'rpbo', 'rdbo'].indexOf(etype) > -1){
					self.sels.objs[i].slider.min = 0;
					self.sels.objs[i].slider.max = 0.5;
					self.sels.objs[i].slider.interval = 0.001;
                    self.sels.objs[i].slider.value = [0.1,0.5];
					self.sels.objs[i].slider.formatter = "{value}";
					
					svals = self.sels.objs[i].slider.value;
					
					maps[i].clearLayers();
					 
					getOverviewDatasets(obj).then(function (res) {
					changeLoadState(`dimmer${i}`, false);

					//obj.scales = res['prop']['scales'];
					resp = res;

					// 获取 slider 情况下的配置值域以及用户其余选项
					let drawProps = getDrawProps_bubble(res, svals, self.sels.ctrsets, drawprop);
					// 绘 Metric Distribution 图函数
					if(['ppbo', 'pdbo', 'rpbo', 'rdbo'].indexOf(etype) > -1){
						maps[i].mapcontourCDrawing_bubble_overlap(res, drawProps)
					}
					else{
						maps[i].mapcontourCDrawing_bubble(res, drawProps);
						}                   
                    }).catch(function (err) {
                        console.error("Failed!", err);
                    });
				}
				else {
					maps[i].clearLayers();
                    self.sels.objs[i].slider.processStyle.background = `-webkit-repeating-linear-gradient(left, #ffffff 0%, #ff0000 100%)`;
                    self.sels.objs[i].slider.formatter = "{value}%";
                    getBoundaryDatasets(city).then(function (res) {
                        changeLoadState(`dimmer${i}`, false);

                        let prop = {
                            'city': city,
                            'etype': etype,
                            'boundary': false,
                            'slider': svals
                        };

                        maps[i].boundaryDrawing(res, prop);
                    }).catch(function (err) {
                        console.error("Failed!", err);
                    });
                }

                if (index !== -1) {
                    break;
                }
            }

            // 改变页面初始化状态
            if (store.state.init) {
                store.commit('updateInitState');
            }
        },
        /**
         * [description]
         * @param  {[type]} index [description]
         * @return {[type]}       [description]
         */
        'getSMetrics': function (index) {
            let i = Number.parseInt(index),
                objs = this.sels.objs,
                city = objs[i].city,
                map = this.maps[i];

            getSMecDatasets(city).then(function (res) {
                for (let i = res.length - 1; i >= 0; i--) {
                    map.smecDrawing(res[i], `${city}-radar${i}`);
                }
            }).catch(function (err) {
                console.error("Failed!", err);
            });

        },
        /**
         * 更新指定 map 面板中选中的 City
         * @param  {[type]} index [description]
         * @param  {[type]} val   [description]
         * @return {[type]}       [description]
         */
        'updateSelectRegion': function (val) {
            let objs = this.sels.objs;
            for (let i = objs.length - 1; i >= 0; i--) {
                objs[i].city = val;
                objs[i].data.smec = smecAve[val];
            }
        },
        /**
         * 动态分析
         * @param  {[type]} val [description]
         * @return {[type]}     [description]
         */
        'openDynamic': function (val) {
            document.getElementById('dynamicview').style.display = "block";
            this.sels.dynamic = !this.sels.dynamic;
            let i = this.sels.lstindex,
                self = this,
                model = this.sels.objs[i],
                props = {
                    'cda': true,
                    'tda': false,
                    'etype': model.etype,
                    'city': model.city,
                    'boundary': this.sels.otype === 1,
                    'ftpval': model.ftpval,
                    'scale': model.scales,
                    'radius': this.sels.ctrsets.radius,
                    'opacity': this.sels.ctrsets.opacity,
                    'useLocalExtrema': this.sels.ctrsets.useLocalExtrema,
                    'rev': model.reverse
                };

            // 默认使用 city 作为 props 初始化配置选项, 若 val 为 t, 那么更新为 timeperiods 选项
            if (val === 't') {
                props.cda = false;
                props.tda = true;
            }
            daview = new dynamicView('dynamicview', props);
        },
        'closeDynamic': function () {
            document.getElementById('dynamicview').style.display = "none";
            this.sels.dynamic = !this.sels.dynamic;
            daview.destroy();
            daview = null;
        },
        /**
         * 更新指定 map 面板中的时间过滤条件
         * @param  {[type]} val   [description]
         * @param  {[type]} index [description]
         * @return {[type]}       [description]
         */
        'updateTPFilter': function (val) {
            let objs = this.sels.objs;

            // 和之前选择一致,逻辑为取消
            // if (objs[0].ftpval === val) {
            //  val = '';
            // }

            let intVal = Number.parseInt(val);

            for (let i = objs.length - 1; i >= 0; i--) {
                if (intVal < 6 || intVal === 9) {
                    objs[i].ftpval = val;
                } else {
                    objs[i].ftpval2 = val;
                }
            }

            // 如果初始化操作未曾进行,此方法直接返回结果不做更新操作
            if (!store.state.init) {
                this.getOverview(-1);
            }
        },
        /**
         * 计算与更新 slider 样式, 更新 map
         * @return {[index]}      [description]
         */
        'updateSlider': function (index) {
            // 定位 slider
            let i = Number.parseInt(index),
                v = this.sels.objs[i].slider.value;

            console.log('v', v);
            // 改变背景色
            if (this.sels.objs[i].reverse) {
                this.sels.objs[i].slider.bgStyle.background = `-webkit-repeating-linear-gradient(left, red 0%, red ${v[1]-0.01}%, white ${v[1]}%, white 100%)`;
            } else {
                this.sels.objs[i].slider.bgStyle.background = `-webkit-repeating-linear-gradient(left, white 0%, white ${v[1]-0.01}%, red ${v[1]}%, red 100%)`;
            }
            
            // 如果初始化操作未曾进行,此方法直接返回结果不做更新操作
            if (store.state.init) {
                return;
            }

            let self = this,
                objs = self.sels.objs;

            let obj = objs[i],
                city = obj.city,
                etype = obj.etype,
                rev = obj.reverse,
                drawprop = {
                    'etype': etype,
                    'rev': rev
                };
            if (['pp', 'pd', 'rp', 'rd', 'de'].indexOf(etype) > -1) {
                // 获取 slider 情况下的配置值域以及用户其余选项
                // v.push(self.components.hrSlider.value);
                //console.log("rsp: " + JSON.stringify(resp.features[resp.features.length * 0.8]['prop']['v']))
				
                let drawProps = getDrawProps(resp, v, self.sels.ctrsets, drawprop);
                maps[i].mapcontourCDrawing({}, drawProps, true);
            } 
			else if(['ppb', 'pdb', 'rpb', 'rdb', 'ppbo', 'pdbo', 'rpbo', 'rdbo'].indexOf(etype) > -1){
				maps[i].clearLayers();
				let drawProps = getDrawProps_bubble(resp, v, self.sels.ctrsets, drawprop);
				if(['ppbo', 'pdbo', 'rpbo', 'rdbo'].indexOf(etype) > -1){
					console.log("update map")
					maps[i].mapcontourCDrawing_bubble_overlap({}, drawProps, true)
				}
				else{
					maps[i].mapcontourCDrawing_bubble({}, drawProps, true);
				} 
				
				if(this.sels.otype === 'b'){
					console.log("update boundary")
				
					let percent = this.sels.objs[i].slider.value[0],
						min_len = this.sels.objs[i].slider4.value;
						
					maps[i].boundaryRemove();
					maps[i].switchLegDisplay('bubblesld');
					
					getThreetypeDatasets(obj, min_len, percent).then(function (res) {
						let prop = {
							'city': city,
							'boundary': true
						};
						changeLoadState(`dimmer${i}`, false);
						if(res.features.length != 0){maps[i].BubbleboundaryDrawing(res, prop);}
					}).catch(function (err) {
							console.error("Failed!", err);
					});
				}
			}
			else {
                let prop = {
                    'city': city,
                    'etype': etype,
                    'boundary': false,
                    'slider': v
                };
                this.sels.objs[i].slider.processStyle.background = `-webkit-repeating-linear-gradient(left, #ffffff 0%, #ff0000 100%)`;
                this.sels.objs[i].slider.formatter = "{value}%";
                maps[i].boundaryDrawing({}, prop, true);
				
				getThreetypeDatasets(obj, min_len, percent).then(function (res) {

				let city = obj.city,
					etype = obj.etype;

				let prop = {
					'city': city,
					'boundary': true
				};
				changeLoadState(`dimmer${i}`, false);
				if(res.features.length != 0){maps[i].BubbleboundaryDrawing(res, prop);}
				}).catch(function (err) {
						console.error("Failed!", err);
				});
            }
        },
        'updateSlider1': function (index) {
            // 定位 slider
            let i = Number.parseInt(index),
                s = this.sels.objs[i].slider1.value,
                c = this.sels.objs[i].slider2.value;

            maps[i].boundaryRemove();
            maps[i].modelDrawing();

            changeLoadState(`dimmer${i}`, true);

            // 如果初始化操作未曾进行,此方法直接返回结果不做更新操作
            if (store.state.init) {
                return;
            }

            let self = this,
                objs = self.sels.objs;

            let obj = objs[i],
                city = obj.city,
                rev = obj.reverse;

            //非在线处理方法：
            getClusterboundaryDatasetsUpdate(objs[i].city, s, c).then(function (res) {

                let city = objs[i].city,
                    etype = objs[i].etype;

                let prop = {
                    'city': city,
                    'boundary': true
                };
                changeLoadState(`dimmer${i}`, false);
                maps[i].ClusterboundaryDrawing(res, prop);
                maps[i].flowerDrawing(res, city);
            }).catch(function (err) {
                console.error("Failed!", err);
            });

        },
        'updateSlider2': function (index) {
            // 定位 slider
            let i = Number.parseInt(index),
                s = this.sels.objs[i].slider1.value, //kmeans中k值
                c = this.sels.objs[i].slider2.value;

            maps[i].boundaryRemove();
            maps[i].modelDrawing();

            changeLoadState(`dimmer${i}`, true);

            // 如果初始化操作未曾进行,此方法直接返回结果不做更新操作
            if (store.state.init) {
                return;
            }

            let self = this,
                objs = self.sels.objs;

            let obj = objs[i],
                city = obj.city,
                rev = obj.reverse;

            //非在线处理方法：
            getClusterboundaryDatasetsUpdate(objs[i].city, s, c).then(function (res) {

                let city = objs[i].city,
                    etype = objs[i].etype;

                let prop = {
                    'city': city,
                    'boundary': true
                };
                changeLoadState(`dimmer${i}`, false);
                maps[i].ClusterboundaryDrawing(res, prop);
                maps[i].flowerDrawing(res, city);
            }).catch(function (err) {
                console.error("Failed!", err);
            });
        },
        'updateSlider3': function (index) {
            // 定位 slider
            let i = Number.parseInt(index),
                k = this.sels.objs[i].slider3.value;

            maps[i].boundaryRemove();
            maps[i].modelDrawing();

            changeLoadState(`dimmer${i}`, true);

            // 如果初始化操作未曾进行,此方法直接返回结果不做更新操作
            if (store.state.init) {
                return;
            }

            let self = this,
                objs = self.sels.objs;

            let obj = objs[i],
                city = obj.city;

            //非在线处理方法：
            getDistrictClusterDatasets(objs[i].city, k).then(function (res) {

                let city = objs[i].city,
                    etype = objs[i].etype;

                let prop = {
                    'city': city,
                    'boundary': true
                };
                changeLoadState(`dimmer${i}`, false);
                maps[i].DistrictClusterDrawing(res, prop);
            }).catch(function (err) {
                console.error("Failed!", err);
            });

            getSMecDatasets(city).then(function (res) {
                maps[i].smecDrawing(res, city);
            }).catch(function (err) {
                console.error("Failed!", err);
            });

        },
		'updateSlider4': function (index) {
            // 定位 slider
            let i = Number.parseInt(index),
                percent = this.sels.objs[i].slider.value[0],
                min_len = this.sels.objs[i].slider4.value;

            maps[i].boundaryRemove();
			maps[i].switchLegDisplay('bubblesld');

            changeLoadState(`dimmer${i}`, true);

            // 如果初始化操作未曾进行,此方法直接返回结果不做更新操作
            if (store.state.init) {
                return;
            }

            let self = this,
                objs = self.sels.objs;

            let obj = objs[i],
                city = obj.city,
                rev = obj.reverse;

            getThreetypeDatasets(obj, min_len, percent).then(function (res) {

				let city = obj.city,
					etype = obj.etype;

				let prop = {
					'city': city,
					'boundary': true
				};
				changeLoadState(`dimmer${i}`, false);
				if(res.features.length != 0){maps[i].BubbleboundaryDrawing(res, prop);}
				}).catch(function (err) {
						console.error("Failed!", err);
				});
        },
        /**
         * 添加分析对象
         * @return {[type]} [description]
         */
        'addAnaObj': function () {
            let self = this,
                currentSize = self.sels.objs.length;
            console.log('currentSize', currentSize);

            switch (currentSize) {
                // 添加一个对象
                case 1:
                    self.updateSels(1, 'add');
                    break;
                    // 复制现有两个对象并添加
                case 2:
                    self.updateSels(2, 'add');
                    break;
                default:
                    alert('No more objects can be created, please remove some first.');
                    break;
            }
        },
        'delAnaObj': function () {
            let self = this,
                currentSize = self.sels.objs.length;

            switch (currentSize) {
                // 删除两个对象
                case 4:
                    self.updateSels(2, 'del');
                    maps.splice(-2, 2);
                    charts.splice(-2, 2);
                    self.sels.lstnum = 2;
                    break;
                    // 删除一个对象
                case 2:
                    maps[1].unsyncmap(maps[0].getMap());
                    maps[0].unsyncmap(maps[1].getMap());
                    maps.splice(-1, 1);
                    charts.splice(-1, 1);
                    self.updateSels(1, 'del');
                    self.sels.lstnum = 1;
                    break;
                default:
                    alert('No more objects can be removed, one object should be reserved in the page.');
                    break;
            }

            this.sels.lstindex = 0;
        },
        /**
         * 更新 vue 实例中存储的 objs 数组, isize 为个数
         * @param  {[type]} isize [description]
         * @param  {[type]} type  [description]
         * @return {[type]}       [description]
         */
        'updateSels': function (isize, type) {
            let self = this;

            for (let i = 0; i < isize; i++) {
                switch (type) {
                    case 'add':
                        let index = self.sels.objs.length,
                            obj = objClone(self.sels.objs[i]);
                        // 更新 objs 中的 id 对象
                        obj.id.card = `card${index}`;
                        obj.id.map = `map${index}`;
                        obj.id.tab = `tab${index}`;

                        self.sels.objs.push(obj);
                        break;
                    default:
                        self.sels.objs.splice(-1, 1);
                        break;
                }
            }
        },
        'optAreaSelect': function (index) {
            let state = this.sels.areaselect,
                objs = this.sels.objs;
            if (!state) {
                for (let i = objs.length - 1; i >= 0; i--) {
                    maps[i].optAreaSelector(true);
                }

                if (objs.length === 2) {
                    console.log(maps[1].getAreaSelect());
                    maps[0].bindAreaSelect(maps[1].getAreaSelect());
                }
            } else {
                for (let i = objs.length - 1; i >= 0; i--) {
                    maps[i].optAreaSelector(false);
                }
            }
            // 
            this.sels.areaselect = !state;
        },
        'getTabImg': function (val, type) {
            let cities = {
                'bj': 0,
                'tj': 1,
                'zjk': 2,
                'ts': 3
            }

            return this.params.regions[`${type}url`];
        },
        'bindTabClick': function (val) {
            this.sels.lstindex = val;
        },
        'pradiusUpd': function () {
            if (store.state.init) {
                return;
            }

            let self = this,
                objs = self.sels.objs;

            for (let i = objs.length - 1; i >= 0; i--) {
                let v = this.sels.objs[i].slider.value;

                this.sels.objs[i].slider.bgStyle.background = `-webkit-repeating-linear-gradient(left, white 0%, white ${v[1]-0.01}%, red ${v[1]}%, red 100%)`;

                let obj = objs[i],
                    city = obj.city,
                    etype = obj.etype,
                    rev = obj.reverse,
                    drawprop = {
                        'etype': etype,
                        'rev': rev
                    };


                // 根据用户所选 metric 类型进行相应数据提取操作
                if (['pp', 'pd', 'rp', 'rd', 'de'].indexOf(etype) > -1) {
                    // 获取 slider 情况下的配置值域以及用户其余选项
                    let drawProps = getDrawProps(resp, v, self.sels.ctrsets, drawprop);
                    //let drawProps = getDrawProps(obj.scales, v, self.sels.ctrsets, drawprop);
                    maps[i].mapcontourCDrawing({}, drawProps, true);
                } else {
                    let prop = {
                        'city': city,
                        'etype': etype,
                        'boundary': false,
                        'slider': v
                    };
                    this.sels.objs[i].slider.processStyle.background = `-webkit-repeating-linear-gradient(left, #ffffff 0%, #ff0000 100%)`;
                    this.sels.objs[i].slider.formatter = "{value}%";
                    maps[i].boundaryDrawing({}, prop, true);
                }
            }
        },
        'revClick': function (index) {
            if (store.state.init) {
                return;
            }

            let self = this,
                i = Number.parseInt(index),
                obj = self.sels.objs[i],
                v = obj.slider.value;

            //this.sels.objs[i].slider.bgStyle.background = '-webkit-repeating-linear-gradient(left, white 0%, white ${v[1]-0.01}%, red ${v[1]}%, red 100%)';
            this.sels.objs[i].slider.formatter = function (value) {
                //console.log("value" + (value + 1))
                return (100 - (100 / Math.log(101) * Math.log(101 - value))).toFixed(2) + "%"
            };

            let city = obj.city,
                etype = obj.etype,
                rev = obj.reverse,
                drawprop = {
                    'etype': etype,
                    'rev': rev
                };
            // 根据用户所选 metric 类型进行相应数据提取操作
            if (['pp', 'pd', 'rp', 'rd', 'de'].indexOf(etype) > -1) {
                // 获取 slider 情况下的配置值域以及用户其余选项
                // v.push(self.components.hrSlider.value);
                this.sels.objs[i].slider.processStyle.background = '-webkit-linear-gradient(left, #ffffff 0%, #ff0000 5%,#ffff00 87%)';
                this.sels.objs[i].slider.bgStyle.background = `-webkit-repeating-linear-gradient(left, red 0%, red ${v[1]-0.01}%, white ${v[1]}%, white 100%)`;
                //this.sels.objs[i].slider.bgStyle.background = '-webkit-repeating-linear-gradient(left, white 0%, white ${v[1]-0.01}%, yellow ${v[1]}%, yellow 100%)';

                //console.log("revvvvvvvvvvv: " + JSON.stringify(this.sels.objs[i].slider.bgStyle.background))
                let drawProps = getDrawProps(resp, v, self.sels.ctrsets, drawprop);
                //let drawProps = getDrawProps(obj.scales, v, self.sels.ctrsets, drawprop);
                maps[i].mapcontourCDrawing({}, drawProps, true);
            } else {
                let prop = {
                    'city': city,
                    'etype': etype,
                    'boundary': false,
                    'slider': v
                };
                this.sels.objs[i].slider.processStyle.background = `-webkit-repeating-linear-gradient(left, #ffffff 0%, #ff0000 100%)`;
                this.sels.objs[i].slider.formatter = "{value}%";
                maps[i].boundaryDrawing({}, prop, true);
            }
        }
    },
    computed: {
        /**
         * 计算 map 的 class name
         */
        mapClass: function () {
            let mapNumber = this.sels.objs.length;
            if (mapNumber === 1) {
                return 'onemap';
            } else if (mapNumber === 2) {
                return 'twomap';
            } else {
                return 'formap';
            }
        },
        /**
         * 判断是否开启 area select 功能
         */
        areaselState: function () {
            if (this.sels.areaselect) {
                return 'negative';
            } else {
                return 'positive';
            }
        }
    },
    watch: {
        'sels.otype': {
            handler: function (val) {
                let self = this,
                    scale = null,
                    index = this.sels.lstindex,
                    objs = this.sels.objs;

                // 删除覆盖层
                if (val === 'e') {
                    // 只删除了boundary没考虑其他类型图层
                    for (let i = objs.length - 1; i >= 0; i--) {
                        maps[i].boundaryRemove();
                    }
                    return;
                }

                for (let i = objs.length - 1; i >= 0; i--) {
                    changeLoadState(`dimmer${i}`, true);
                }

                // POI
                if (val === 'p') {
                    getAOIDatasets(objs[0].city, '0').then(function (res) {
                        for (let i = objs.length - 1; i >= 0; i--) {
                            let city = objs[i].city,
                                etype = objs[i].etype,
                                prop = {
                                    'thre': 11
                                };

                            changeLoadState(`dimmer${i}`, false);

                            // 每个窗口均填充上AOI点分布
                            maps[i].aoisDrawing(res, prop);
                        }
                    }).catch(function (err) {
                        console.error("Failed!", err);
                    })
                }

                //cluster
                if (val === 'c') {
                    let city = objs[index].city,
                        map = maps[index];

                    getClusterboundaryDatasets(city).then(function (res) {
                        for (let i = objs.length - 1; i >= 0; i--) {
                            changeLoadState(`dimmer${i}`, false);
                        }

                        map.modelDrawing();
                        let s = objs[index].slider1.value,
                            c = objs[index].slider2.value;

                        let prop = {
                            'city': city,
                            'boundary': true
                        };
                        map.ClusterboundaryDrawing(res, prop);
                        map.flowerDrawing(res, city)
                    }).catch(function (err) {
                        console.error("Failed!", err);
                    });
                }

                // Districts
                if (val === 'd') {
                    getBoundaryDatasets(objs[0].city).then(function (res) {
                        for (let i = objs.length - 1; i >= 0; i--) {
                            let city = objs[i].city,
                                etype = objs[i].etype,
                                svals = objs[i].slider.value;

                            console.log("etype: " + etype)
                            console.log("svals: " + svals)

                            changeLoadState(`dimmer${i}`, false);

                            let prop = {
                                'city': city,
                                'etype': etype,
                                'boundary': true,
                                'slider': svals,
                                'revColor': false
                            };

                            maps[i].boundaryDrawing(res, prop);
                        }


                    }).catch(function (err) {
                        console.error("Failed!", err);
                    });
                }

                // District Extra
                if (val === 'de') {
                    getBoundaryDatasets(objs[0].city).then(function (res) {
                        for (let i = objs.length - 1; i >= 0; i--) {
                            let city = objs[i].city,
                                etype = objs[i].etype,
                                svals = objs[i].slider.value;

                            console.log("etype: " + etype)
                            console.log("svals: " + svals)

                            changeLoadState(`dimmer${i}`, false);

                            let prop = {
                                'city': city,
                                'etype': etype,
                                'boundary': true,
                                'slider': svals,
                                'revColor': true
                            };

                            maps[i].boundaryDrawing(res, prop);
                        }


                    }).catch(function (err) {
                        console.error("Failed!", err);
                    });
                }

                // FACET
                if (val === 'f') {
                    // 只处理一个页面下的绘制逻辑
                    let city = objs[index].city,
                        map = maps[index],
                        k = objs[index].slider3.value;

                    map.modelDrawing(); //蒙版

                    getSMecDatasets(city).then(function (res) {
                        map.smecDrawing(res, city);
                    }).catch(function (err) {
                        console.error("Failed!", err);
                    });

                    getDistrictClusterDatasets(city, k).then(function (res) {
                        for (let i = objs.length - 1; i >= 0; i--) {
                            changeLoadState(`dimmer${i}`, false);
                        }

                        let prop = {
                            'city': city,
                            'boundary': true,
                            'slider': objs[index].slider3.value
                        };

                        map.DistrictClusterDrawing(res, prop);

                    }).catch(function (err) {
                        console.error("Failed!", err);
                    });

                }
				//Bubble Boundary
				if(val == 'b'){
					let min_len = 15,
						percent = objs[index].slider.value[0];
					maps[index].switchLegDisplay('bubblesld');
					getThreetypeDatasets(objs[index], min_len, percent).then(function (res) {

					let city = objs[index].city,
						etype = objs[index].etype;

					let prop = {
						'city': city,
						'boundary': true
					};
					changeLoadState(`dimmer${index}`, false);
					maps[index].BubbleboundaryDrawing(res, prop);
					}).catch(function (err) {
						console.error("Failed!", err);
					});
				}
            }
        },
        'sels.ctrsets.opacity': {
            handler: function (val) {
                if (store.state.init) {
                    return;
                }

                let self = this,
                    objs = self.sels.objs;

                for (let i = objs.length - 1; i >= 0; i--) {
                    let v = this.sels.objs[i].slider.value;

                    this.sels.objs[i].slider.bgStyle.background = `-webkit-repeating-linear-gradient(left, white 0%, white ${v[1]-0.01}%, red ${v[1]}%, red 100%)`;

                    let obj = objs[i],
                        city = obj.city,
                        etype = obj.etype,
                        rev = obj.reverse,
                        drawprop = {
                            'etype': etype,
                            'rev': rev
                        };

                    // 根据用户所选 metric 类型进行相应数据提取操作
                    if (['pp', 'pd', 'rp', 'rd', 'de'].indexOf(etype) > -1) {
                        // 获取 slider 情况下的配置值域以及用户其余选项
                        // v.push(self.components.hrSlider.value);
                        let drawProps = getDrawProps(resp, v, self.sels.ctrsets, drawprop);
                        //let drawProps = getDrawProps(obj.scales, v, self.sels.ctrsets, drawprop);
                        maps[i].mapcontourCDrawing({}, drawProps, true);
                    } else {
                        let prop = {
                            'city': city,
                            'etype': etype,
                            'boundary': false,
                            'slider': v
                        };
                        this.sels.objs[i].slider.processStyle.background = `-webkit-repeating-linear-gradient(left, #ffffff 0%, #ff0000 100%)`;
                        this.sels.objs[i].slider.formatter = "{value}%";
                        maps[i].boundaryDrawing({}, prop, true);
                    }
                }
            },
            deep: false
        }
    },
    mounted() {
        let self = this;
        this.$nextTick(function () {
            let firstcity = this.sels.objs[0].city;
            maps[0] = new mapview('map0', 'gridmaplegend0', 'contourmaplegend0', 'districtslider0', 'clusterslider0', 'bubbleslider0','baselyrtext0', firstcity);
            charts[0] = new chart('#estatChart0');
            self.getOverview(0);
        });
    },
    updated() {
        let self = this,
            pIndex = this.sels.lstindex,
            curnum = self.sels.objs.length,
            lstnum = self.sels.lstnum,
            svals = self.sels.objs[pIndex].slider.value,
            objs = self.sels.objs,
            etype = objs[pIndex].etype,
            drawprop = {
                'rev': false
            }; // 批量化使用的 etype 熵类型;

        console.log('curnum', curnum, 'lstnum', lstnum);

        if (curnum !== 4 && curnum !== 6 && curnum > lstnum && !this.sels.cda && !this.sels.tda) {
            // 更新 map 内绘制规格
            // 非同步操作: 将视图聚焦切换到最新的 tab 上
            maps[0].invalidateSize();

            for (let i = curnum - 1; i >= lstnum; i--) {
                // 新建 map & chart model view
                maps[i] = new mapview(`map${i}`, `gridmaplegend${i}`, `contourmaplegend${i}`, `districtslider${i}`, `clusterslider${i}`, `bubbleslider${i}`,`baselyrtext${i}`, self.sels.objs[i].city);
                maps[i].syncmap(maps[0].getMap());
                maps[0].syncmap(maps[i].getMap());

                charts[i] = new chart(`#estatChart${i}`);

                // 更新视图
                self.$refs[`eSlider${i}`][0].refresh();
                // self.getOverview(i);
            }

            self.sels.lstnum = curnum;
            self.sels.lstindex = curnum - 1;
        }
    }
});