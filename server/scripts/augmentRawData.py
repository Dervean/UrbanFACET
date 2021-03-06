#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Date    : 2017-02-06 14:16:11
# @Author  : Joe Jiang (hijiangtao@gmail.com)
# @Link    : https://hijiangtao.github.io/
# 描述      : 从原始数据中提取行政区划，时间段等信息并按照用户ID分文件存储 / to idcollection

import threading
import os
import time
import datetime
import pp
import logging
import sys
import getopt
import gc
import random
from CommonFunc import getTimePeriod, getCityLocs
from CommonFunc import getAdminNumber as formatAdmin
from multiprocessing import Process, Manager, Value, Array, Lock
from ctypes import c_wchar_p
tLock = threading.Lock()
pLock = Lock()

# 多线程扩充类
class augmentRawData (threading.Thread):
	def __init__(self, INDEX, CITY, FILENUM, DIRECTORY ):
		threading.Thread.__init__(self)
		self.INDEX = INDEX
		self.CITY= CITY
		self.FILENUM = FILENUM
		self.DIRECTORY = DIRECTORY

	def augment(self, inputfile, outputfile, CITY, FILENUM = 1000):
		reslist = ['' for i in range(FILENUM)]
		# print "Begin read file at %s" % time.time()
		with open(inputfile, 'rb') as stream:
			# print "Finished read file at %s" % time.time()
			for line in stream:
				linelist = line.strip('\n').split(',')
				index = int(linelist[0]) % FILENUM

				# formatAdmin(linelist[5].strip())
				# linelist[5]
				reslist[ index ] += linelist[0] + ',' + formatTime(linelist[1]) + ',' + formatAdmin(linelist[5]) + ',' + formatGridID(getCityLocs(CITY), [linelist[3], linelist[2]]) + '\n'
		stream.close()
		gc.collect()

		# print "Begin write file at %s" % time.time()
		for i in range(FILENUM):
			tLock.acquire()
			
			with open('%s/res-%05d' % (outputfile, i), 'ab') as res:
				res.write( reslist[i] )
			res.close()

			# 释放锁
			tLock.release()
		# print "Finished write file at %s" % time.time()

	def run(self):
		logging.info('TASK %d running...' % self.INDEX)

		rawdatadir = os.path.join(self.DIRECTORY, 'rawdata' )
		idcoldir = os.path.join(self.DIRECTORY, 'idcollection' )
		for x in xrange(0, 10000000):
			number = self.INDEX + 20 * x
			if number > self.FILENUM:
				break

			logging.info('TASK %d - FILE part-%05d operating...' % (self.INDEX, number))
			self.augment(os.path.join(rawdatadir, self.CITY, 'part-%05d' % number), os.path.join(idcoldir, self.CITY), self.CITY, 1000)

		print "Task %s finished time:" % str(self.INDEX)
		print time.time()

# 多进程扩充类
class augmentRawDatainMultiProcess():
	def __init__(self, STARTTIME, INDEX, CITY, FILENUM, DIRECTORY, strData, listCount, resfilenum ):
		self.INDEX = INDEX
		self.CITY= CITY
		self.FILENUM = FILENUM
		self.DIRECTORY = DIRECTORY
		self.strData = strData
		self.listCount = listCount
		self.MAXRECORDS = 100000000
		self.STARTTIME = STARTTIME
		self.resfilenum = resfilenum

	def augment(self, inputfile, outputfile, CITY):
		reslist = ['' for i in range(self.resfilenum)]
		resnumber = 0
		with open(inputfile, 'rb') as stream:
			for line in stream:
				resnumber += 1
				linelist = line.strip('\n').split(',')
				index = int(linelist[0]) % self.resfilenum

				reslist[ index ] += linelist[0] + ',' + formatTime(linelist[1]) + ',' + formatAdmin(linelist[4]) + ',' + formatGridID(getCityLocs(CITY), [linelist[3], linelist[2]]) + '\n'
		stream.close()
		
		global pLock
		# localFileStream = []

		with pLock:
			print "CountVal %d at time %s" % (self.listCount.value, str(time.time()-self.STARTTIME))

			self.listCount.value += resnumber

			if self.listCount.value > self.MAXRECORDS:
				print "PROCESS ID-%d has one write operation at %s." % (self.INDEX, str(time.time()-self.STARTTIME))

				for x in xrange(0, self.resfilenum):
					with open('%s/res-%05d' % (outputfile, x), 'ab') as res:
						res.write( self.strData[x].value + reslist[x] )
					res.close()
					# localFileStream.append( self.strData[x].value + reslist[x] )
					self.strData[x].value = ''

				# 计数器重置为 0
				self.listCount.value = 0
				gc.collect()
			else:
				for x in xrange(0, self.resfilenum):
					self.strData[x].value += reslist[x]

	def run(self):
		logging.info('TASK %d running...' % self.INDEX)

		rawdatadir = os.path.join(self.DIRECTORY, 'rawdata' )
		idcoldir = os.path.join(self.DIRECTORY, 'idcollection' )
		for x in xrange(0, 10000000):
			number = self.INDEX + 20 * x
			if number > self.FILENUM:
				break

			logging.info('TASK %d - FILE part-%05d operating...' % (self.INDEX, number))
			self.augment(os.path.join(rawdatadir, self.CITY, 'part-%05d' % number), os.path.join(idcoldir, self.CITY), self.CITY)

		print "Task %s finished time:" % str(self.INDEX)
		print time.time()

def formatTime(timestr):
	"""格式化时间戳
	
	Args:
		timestr (TYPE): Description
	
	Returns:
		TYPE: Description
	"""
	dateObj = time.localtime( int(timestr)/1000.0 )
	
	date = time.strftime("%m-%d", dateObj)
	hourmin = time.strftime("%H:%M", dateObj)
	day = time.strftime("%w", dateObj)
	period = str( getTimePeriod( time.strftime("%H", dateObj) ) )

	return date + ',' + hourmin + ',' + day + ',' + period

def formatGridID(locs, point):
	"""根据经纬度计算城市网格编号
	
	Args:
		locs (TYPE): Description
		point (TYPE): [lng, lat]
	
	Returns:
		TYPE: Description
	"""
	SPLIT = 0.003
	# LATNUM = int((locs['north'] - locs['south']) / SPLIT + 1)
	LNGNUM = int((locs['east'] - locs['west']) / SPLIT + 1)
	lngind = int( (float(point[0]) - locs['west']) / SPLIT )
	latind = int( (float(point[1]) - locs['south']) / SPLIT )

	return str(lngind + latind * LNGNUM)

# 多进程情况下处理单个进程的启动
def processTask(STARTTIME, x, city, number, directory, strdata, countdata, resfilenum):
	task = augmentRawDatainMultiProcess(STARTTIME, x, city, number, directory, strdata, countdata, resfilenum)
	task.run()

def usage():
	print '''Usage Guidance
help	-h	get usage guidance
city	-c	set the city or region, such as beijing, binhai
directory	-d	the root directory of records, contains rawdata/idcollection folders, etc
number	-n	the file number of rawdata
'''

def main(argv):
	try:
		opts, args = getopt.getopt(argv, "hc:d:n:", ["help", "city=", 'directory=', 'number='])
	except getopt.GetoptError as err:
		# print help information and exit:
		print str(err)  # will print something like "option -a not recognized"
		usage()
		sys.exit(2)

	# 处理输入参数
	city, directory, number, resfilenum = 'zhangjiakou', '/home/tao.jiang/datasets/JingJinJi/records', 264, 1000
	for opt, arg in opts:
		if opt == '-h':
			usage()
			sys.exit()
		elif opt in ("-c", "--city"):
			city = arg
		elif opt in ("-d", "--directory"):
			directory = arg
		elif opt in ('-n', '--number'):
			number = int(arg)

	STARTTIME = time.time()
	print "Start approach at %s" % STARTTIME

	# @多进程运行程序 START
	manager = Manager()
	jobs = []

	listcount = Value('i', 0)
	taskdata = []
	# 初始化
	for x in xrange(0, resfilenum):
		taskdata.append( manager.Value(c_wchar_p, "") )

	for x in xrange(0,20):
		# time.sleep(random.random()*2)
		jobs.append( Process(target=processTask, args=(STARTTIME, x, city, number, directory, taskdata, listcount, resfilenum)) )
		jobs[x].start()

	# 等待所有进程结束
	for job in jobs:
	    job.join()

	# 处理剩余数据进文件
	for x in xrange(0, resfilenum):
		if taskdata[x].value != '':
			with open('%s/res-%05d' % (os.path.join(directory, 'idcollection', city ), x), 'ab') as res:
				res.write( taskdata[x].value )
			res.close()
	# @多进程运行程序 END

	# @多线程运行程序
	# threads = []
	# for x in xrange(0,20):
	# 	threads.append( augmentRawData(x, city, number, directory) )
	# 	threads[x].start()

	print "Goodbye %s" % time.time()
	
if __name__ == '__main__':
	logging.basicConfig(filename='logger-augmentrawdata.log', level=logging.DEBUG)
	main(sys.argv[1:])