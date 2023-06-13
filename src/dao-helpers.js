class SimpleDaoArchive {

    constructor(mainDao, sndDao, logger = null) {
        this.mainDao = mainDao;
        this.sndDao = sndDao;
        this.logger = logger;
    }

    logError(msg, err) {
        if (this.logger) {
            this.logger.error(msg, err);            
        }
    }

    logInfo(msg) {
        if (this.logger) {
            this.logger.info(msg);
        } else {
            console.log(msg);
        }
    }

    async find(model, query, options = {}) {
        try {
            let results = [];
            results = await this.mainDao.for(model)
                                        .find(query, options)
                                        .toArray();
            if (results.length === 0 && this.sndDao) {
                results = await this.sndDao.for(model)
                                            .find(query, options)
                                            .toArray();
            }
            return results;
        } catch (error) {
            this.logError("SimpleDaoArchive: Error performing find", error);
            throw error;
        }
    };

    async findById(model, id) {
        try {
            let result = null;
            result = await this.mainDao.for(model)
                                .findById(id);
            if (!result  && this.sndDao) {
                result = await this.sndDao.for(model)
                                    .findById(id);
            }
            return result;
        } catch (error) {
            this.logError("SimpleDaoArchive: Error performing findById", error);
            throw error;
        }
    }
}

module.exports = {
    SimpleDaoArchive
};