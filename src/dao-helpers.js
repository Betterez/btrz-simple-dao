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